import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals, url }) => {
  const db = locals.runtime.env.DB as D1Database;
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(JSON.stringify({ error: "order id required" }), { status: 400 });
  }

  const order = await db.prepare(
    "SELECT id, customer_name, customer_email, total, status, mp_preference_id, mp_payment_id, payment_method, created_at FROM orders WHERE id = ?"
  ).bind(id).first<any>();

  if (!order) {
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  }

  const { results: items } = await db.prepare(
    "SELECT product_id, product_title, quantity, unit_price, subtotal FROM order_items WHERE order_id = ?"
  ).bind(id).all();

  return new Response(JSON.stringify({ ...order, items }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
