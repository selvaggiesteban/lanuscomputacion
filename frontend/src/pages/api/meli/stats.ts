import type { APIRoute } from "astro";
import { requireAdmin, unauthorized } from "../../../lib/admin-auth";

// GET /api/meli/stats — productos totales vs. vinculados a Mercado Libre.
export const GET: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();

  try {
    const total = await auth.DB.prepare("SELECT COUNT(*) as count FROM products").first<{ count: number }>();
    const synced = await auth.DB.prepare("SELECT COUNT(*) as count FROM products WHERE ml_item_id IS NOT NULL").first<{ count: number }>();

    return new Response(JSON.stringify({
      total: total?.count || 0,
      synced: synced?.count || 0,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
