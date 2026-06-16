import type { APIRoute } from "astro";
import { getUserFromRequest } from "../../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = locals.runtime.env.JWT_SECRET as string;
  const user = await getUserFromRequest(request, db, jwtSecret);

  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  const { results: orders } = await db.prepare(
    "SELECT * FROM orders ORDER BY created_at DESC LIMIT 100"
  ).all();

  return new Response(JSON.stringify({ orders }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const PUT: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = locals.runtime.env.JWT_SECRET as string;
  const user = await getUserFromRequest(request, db, jwtSecret);

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

  await db.prepare(
    "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(body.status, body.id).run();

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};
