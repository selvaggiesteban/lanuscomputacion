import type { APIRoute } from "astro";
import { getUserFromRequest } from "../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = locals.runtime.env.JWT_SECRET as string;
  const user = await getUserFromRequest(request, db, jwtSecret);

  if (!user) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { results: favorites } = await db.prepare(`
    SELECT f.product_id, f.created_at,
           p.title, p.slug, p.price, p.thumbnail, p.available_qty
    FROM favorites f
    JOIN products p ON p.id = f.product_id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `).bind(user.id).all();

  return new Response(JSON.stringify({ favorites }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = locals.runtime.env.JWT_SECRET as string;
  const user = await getUserFromRequest(request, db, jwtSecret);

  if (!user) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { product_id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  if (!body.product_id) {
    return new Response(JSON.stringify({ error: "Falta product_id" }), { status: 400 });
  }

  await db.prepare(
    "INSERT OR IGNORE INTO favorites (user_id, product_id, created_at) VALUES (?, ?, datetime('now'))"
  ).bind(user.id, body.product_id).run();

  return new Response(JSON.stringify({ success: true }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = locals.runtime.env.JWT_SECRET as string;
  const user = await getUserFromRequest(request, db, jwtSecret);

  if (!user) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { product_id?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  if (!body.product_id) {
    return new Response(JSON.stringify({ error: "Falta product_id" }), { status: 400 });
  }

  await db.prepare(
    "DELETE FROM favorites WHERE user_id = ? AND product_id = ?"
  ).bind(user.id, body.product_id).run();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
