import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const DB = locals.runtime.env.DB as D1Database;
    const id = url.searchParams.get("id");

    if (!id) {
      return new Response(JSON.stringify({ error: "order id required" }), { status: 400 });
    }

    let order = null;
    try {
      order = await DB.prepare(
        "SELECT id, customer_name, customer_email, total, status, mp_preference_id, mp_payment_id, payment_method, created_at FROM orders WHERE id = ?"
      ).bind(id).first<any>();
    } catch (e) {
      console.error("D1 Error in frontend/src/pages/api/order.ts:", e);
      order = null;
    }

    if (!order) {
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    }

    let items = [];
    try {
      const { results } = await DB.prepare(
        "SELECT product_id, product_title, quantity, unit_price, subtotal FROM order_items WHERE order_id = ?"
      ).bind(id).all();
      items = results || [];
    } catch (e) {
      console.error("D1 Error in frontend/src/pages/api/order.ts:", e);
      items = [];
    }

    return new Response(JSON.stringify({ ...order, items: items || [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Order API error:", err);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500 });
  }
};
