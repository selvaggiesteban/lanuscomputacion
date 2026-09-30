import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);

  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  let orders = [];
  try {
    const { results } = await DB.prepare(
      "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100"
    ).all();
    orders = results;
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/orders.ts:", e);
  }

  return new Response(JSON.stringify({ orders: (orders || []) }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const PUT: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);

  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  let body: { id?: string; status?: string };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  if (!body.id || !body.status) {
    return new Response(JSON.stringify({ error: "Faltan id y status" }), { status: 400 });
  }

  const validStatuses = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"];
  if (!validStatuses.includes(body.status)) {
    return new Response(JSON.stringify({ error: "Estado inválido" }), { status: 400 });
  }

  try {
    await DB.prepare(
      "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(body.status, body.id).run();
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/orders.ts:", e);
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};
