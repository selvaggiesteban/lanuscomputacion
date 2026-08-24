import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../../lib/auth";

async function requireAdmin(locals: any, request: Request) {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, db, jwtSecret);
  if (!user || !user.is_admin) return null;
  return { db, user };
}

export const GET: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  const { db } = auth;

  const url = new URL(request.url);
  const days = Number(url.searchParams.get("days") || "30");
  const daysStr = "-" + days + " days";

  // Current dollar rate
  const currentDollar = await db.prepare(
    "SELECT rate, source, fetched_at FROM dollar_rate_history ORDER BY fetched_at DESC LIMIT 1"
  ).first<{ rate: number; source: string; fetched_at: string }>();

  // Dollar rate history (last N days)
  const dollarHistoryResult = await db.prepare(
    "SELECT rate, source, fetched_at FROM dollar_rate_history WHERE fetched_at >= datetime('now', ?) ORDER BY fetched_at ASC"
  ).bind(daysStr).all<{ rate: number; source: string; fetched_at: string }>();

  // Price changes summary
  const priceChangeStats = await db.prepare(
    "SELECT COUNT(*) as total_changes, COUNT(DISTINCT product_id) as products_affected, " +
    "SUM(CASE WHEN reason = 'dollar_change' THEN 1 ELSE 0 END) as dollar_driven, " +
    "SUM(CASE WHEN reason = 'sync' THEN 1 ELSE 0 END) as sync_driven, " +
    "SUM(CASE WHEN reason = 'manual' THEN 1 ELSE 0 END) as manual_changes, " +
    "SUM(CASE WHEN reason = 'promotion' THEN 1 ELSE 0 END) as promo_changes " +
    "FROM price_history WHERE changed_at >= datetime('now', ?)"
  ).bind(daysStr).first();

  // Recent price changes (last 20)
  const recentPriceChangesResult = await db.prepare(
    "SELECT ph.*, p.title, p.brand FROM price_history ph " +
    "LEFT JOIN products p ON ph.product_id = p.id " +
    "WHERE ph.changed_at >= datetime('now', ?) ORDER BY ph.changed_at DESC LIMIT 20"
  ).bind(daysStr).all();

  // Margin analysis
  const marginStats = await db.prepare(
    "SELECT AVG(CASE WHEN cost_price > 0 THEN ((price - cost_price) / cost_price * 100) END) as avg_margin, " +
    "MIN(CASE WHEN cost_price > 0 THEN ((price - cost_price) / cost_price * 100) END) as min_margin, " +
    "MAX(CASE WHEN cost_price > 0 THEN ((price - cost_price) / cost_price * 100) END) as max_margin, " +
    "COUNT(CASE WHEN cost_price > 0 AND ((price - cost_price) / cost_price * 100) < 10 THEN 1 END) as low_margin_count, " +
    "COUNT(CASE WHEN cost_price > 0 AND ((price - cost_price) / cost_price * 100) > 50 THEN 1 END) as high_margin_count " +
    "FROM products WHERE status = 'published' AND cost_price > 0"
  ).first();

  // Top margin products
  const topMarginResult = await db.prepare(
    "SELECT title, brand, price, cost_price, ROUND((price - cost_price) / cost_price * 100, 1) as margin_pct " +
    "FROM products WHERE status = 'published' AND cost_price > 0 ORDER BY margin_pct DESC LIMIT 10"
  ).all();

  // Bottom margin products
  const bottomMarginResult = await db.prepare(
    "SELECT title, brand, price, cost_price, ROUND((price - cost_price) / cost_price * 100, 1) as margin_pct " +
    "FROM products WHERE status = 'published' AND cost_price > 0 AND available_qty > 0 ORDER BY margin_pct ASC LIMIT 10"
  ).all();

  // Inventory value
  const inventoryValue = await db.prepare(
    "SELECT SUM(price * available_qty) as total_value, SUM(cost_price * available_qty) as total_cost, " +
    "COUNT(*) as total_products, SUM(available_qty) as total_units " +
    "FROM products WHERE status = 'published' AND cost_price > 0"
  ).first();

  // Active promotions
  const activePromos = await db.prepare(
    "SELECT COUNT(*) as count FROM promotions WHERE is_active = 1 " +
    "AND (start_date IS NULL OR start_date <= datetime('now')) " +
    "AND (end_date IS NULL OR end_date >= datetime('now'))"
  ).first<{ count: number }>();

  // Low stock count
  const lowStock = await db.prepare(
    "SELECT COUNT(*) as count FROM products WHERE status = 'published' AND available_qty > 0 AND available_qty <= 5"
  ).first<{ count: number }>();

  return new Response(JSON.stringify({
    currentDollar,
    dollarHistory: dollarHistoryResult.results,
    priceChangeStats,
    recentPriceChanges: recentPriceChangesResult.results,
    marginStats,
    topMarginProducts: topMarginResult.results,
    bottomMarginProducts: bottomMarginResult.results,
    inventoryValue,
    activePromos: activePromos?.count ?? 0,
    lowStockCount: lowStock?.count ?? 0,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
