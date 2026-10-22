import type { APIRoute } from "astro";

// POST /api/track/abandoned — upsert anónimo (sesión en localStorage) del
// carrito en proceso de checkout. Sin auth: solo escritura acotada.
export const POST: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;

  let body: {
    session_id?: string;
    items?: { product_id?: string; title?: string; quantity?: number; price?: number }[];
    customer?: { name?: string; email?: string; phone?: string; address?: string };
    page?: string;
    order_id?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id.trim() : "";
  if (!sessionId || sessionId.length > 64) {
    return new Response(JSON.stringify({ error: "session_id inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    if (body.order_id) {
      await DB.prepare(
        "UPDATE abandoned_carts SET order_id = ?, last_seen_at = datetime('now') WHERE session_id = ? AND order_id IS NULL"
      ).bind(String(body.order_id).slice(0, 64), sessionId).run();
      return new Response(JSON.stringify({ ok: true, converted: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
    if (items.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    let itemCount = 0;
    let total = 0;
    for (const i of items) {
      const qty = Math.max(1, Math.min(999, Number(i.quantity) || 1));
      const price = Math.max(0, Number(i.price) || 0);
      itemCount += qty;
      total += qty * price;
    }
    total = Math.round(total * 100) / 100;

    const itemsJson = JSON.stringify(
      items.map((i) => ({
        product_id: String(i.product_id || "").slice(0, 64),
        title: String(i.title || "").slice(0, 300),
        quantity: Math.max(1, Math.min(999, Number(i.quantity) || 1)),
        price: Math.max(0, Number(i.price) || 0),
      }))
    );

    const c = body.customer || {};
    const name = String(c.name || "").slice(0, 200);
    const email = String(c.email || "").slice(0, 200);
    const phone = String(c.phone || "").slice(0, 50);
    const address = String(c.address || "").slice(0, 300);
    const page = String(body.page || "").slice(0, 300);

    const update = await DB.prepare(
      `UPDATE abandoned_carts
         SET items = ?, item_count = ?, total = ?, customer_name = ?, customer_email = ?,
             customer_phone = ?, customer_address = ?, page = ?, last_seen_at = datetime('now')
       WHERE session_id = ? AND order_id IS NULL`
    ).bind(itemsJson, itemCount, total, name, email, phone, address, page, sessionId).run();

    if (!update.meta?.changes) {
      await DB.prepare(
        `INSERT INTO abandoned_carts
           (session_id, items, item_count, total, customer_name, customer_email, customer_phone, customer_address, page, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(sessionId, itemsJson, itemCount, total, name, email, phone, address, page).run();
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[track/abandoned] error:", e);
    return new Response(JSON.stringify({ error: "Error interno" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
