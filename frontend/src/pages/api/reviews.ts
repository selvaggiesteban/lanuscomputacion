import type { APIRoute } from "astro";
import { getUserFromRequest } from "../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = locals.runtime.env.JWT_SECRET as string;

  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id");

  if (!productId) {
    return new Response(JSON.stringify({ error: "product_id requerido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { results } = await db.prepare(
    "SELECT id, product_id, customer_name, rating, title, comment, is_verified, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC"
  ).bind(productId).all();

  const stats = await db.prepare(
    "SELECT COUNT(*) as count, AVG(rating) as avg_rating FROM reviews WHERE product_id = ?"
  ).bind(productId).first<{ count: number; avg_rating: number }>();

  return new Response(JSON.stringify({
    reviews: results,
    stats: { count: stats?.count || 0, avg_rating: stats?.avg_rating || 0 },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = locals.runtime.env.JWT_SECRET as string;

  const user = await getUserFromRequest(request, db, jwtSecret);
  if (!user) {
    return new Response(JSON.stringify({ error: "Debés iniciar sesión para reseñar" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  let body: { product_id?: string; rating?: number; title?: string; comment?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!body.product_id || !body.rating || body.rating < 1 || body.rating > 5) {
    return new Response(JSON.stringify({ error: "Datos inválidos: product_id, rating (1-5)" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Check if user already reviewed this product
  const existing = await db.prepare(
    "SELECT id FROM reviews WHERE product_id = ? AND customer_id = ?"
  ).bind(body.product_id, user.id).first();

  if (existing) {
    return new Response(JSON.stringify({ error: "Ya reseñaste este producto" }), { status: 409, headers: { "Content-Type": "application/json" } });
  }

  // Check if user bought this product (verified review)
  const purchase = await db.prepare(
    "SELECT oi.order_id FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE oi.product_id = ? AND o.customer_email = ? AND o.status = 'paid' LIMIT 1"
  ).bind(body.product_id, user.email).first();

  await db.prepare(`
    INSERT INTO reviews (product_id, customer_id, customer_name, rating, title, comment, is_verified, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    body.product_id,
    user.id,
    user.name,
    body.rating,
    body.title || null,
    body.comment || null,
    purchase ? 1 : 0
  ).run();

  return new Response(JSON.stringify({ success: true }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
