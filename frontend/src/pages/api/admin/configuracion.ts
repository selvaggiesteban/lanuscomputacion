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

  const { results: configRows } = await db.prepare("SELECT key, value FROM app_config").all<{ key: string; value: string }>();
  const config: Record<string, string> = {};
  for (const row of configRows) config[row.key] = row.value;

  // Defaults
  if (!config.global_markup_pct) config.global_markup_pct = "30";
  if (!config.dollar_change_threshold) config.dollar_change_threshold = "2";
  if (!config.low_stock_threshold) config.low_stock_threshold = "5";
  if (!config.auto_recalc_prices) config.auto_recalc_prices = "true";

  return new Response(JSON.stringify({ config }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const PUT: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  const { db } = auth;

  let body: Record<string, string>;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const allowedKeys = ["global_markup_pct", "dollar_change_threshold", "low_stock_threshold", "auto_recalc_prices"];

  for (const [key, value] of Object.entries(body)) {
    if (allowedKeys.includes(key)) {
      await db.prepare(
        "INSERT OR REPLACE INTO app_config (key, value, updated_at) VALUES (?, ?, datetime('now'))"
      ).bind(key, String(value)).run();
    }
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
