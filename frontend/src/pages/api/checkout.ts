import type { APIRoute } from "astro";

const MP_API = "https://api.mercadopago.com";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const mpToken = locals.runtime.env.MP_ACCESS_TOKEN as string;

  if (!mpToken) {
    return new Response(JSON.stringify({ error: "MercadoPago no configurado" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  let body: { items?: { product_id: string; quantity: number }[]; customer?: { name: string; email: string; phone?: string; address?: string } };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!body.items?.length || !body.customer?.name || !body.customer?.email) {
    return new Response(JSON.stringify({ error: "Faltan datos: items, customer.name, customer.email" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    const ids = body.items.map(i => i.product_id);
    const placeholders = ids.map(() => "?").join(",");
    const { results: products } = await db.prepare(
      `SELECT id, title, price, available_qty, thumbnail, slug FROM products WHERE id IN (${placeholders}) AND status = 'published'`
    ).bind(...ids).all<{ id: string; title: string; price: number; available_qty: number; thumbnail: string; slug: string }>();

    const productMap = new Map(products.map(p => [String(p.id), p]));

    const mpItems: any[] = [];
    let total = 0;

    for (const item of body.items) {
      const product = productMap.get(String(item.product_id));
      if (!product) {
        return new Response(JSON.stringify({ error: `Producto no encontrado: ${item.product_id}` }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      if (product.available_qty < item.quantity) {
        return new Response(JSON.stringify({ error: `Stock insuficiente: ${product.title}` }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      const subtotal = Math.round(product.price * item.quantity * 100) / 100;
      total += subtotal;
      mpItems.push({
        id: String(product.id),
        title: product.title,
        quantity: item.quantity,
        unit_price: Math.round(product.price * 100) / 100,
        currency_id: "ARS",
        picture_url: product.thumbnail || undefined,
      });
    }

    const origin = new URL(request.url).origin;
    const orderId = crypto.randomUUID();

    const preference: any = {
      items: mpItems,
      payer: {
        name: body.customer.name,
        email: body.customer.email,
        phone: body.customer.phone ? { area_code: "", number: body.customer.phone } : undefined,
        address: body.customer.address ? { street_name: body.customer.address, street_number: "" } : undefined,
      },
      back_urls: {
        success: `${origin}/checkout/success?order_id=${orderId}`,
        failure: `${origin}/checkout/failure?order_id=${orderId}`,
        pending: `${origin}/checkout/pending?order_id=${orderId}`,
      },
      notification_url: `${origin}/api/webhook/mp`,
      auto_return: "approved",
      external_reference: orderId,
      statement_descriptor: "LANUSCOMP",
    };

    const mpRes = await fetch(`${MP_API}/checkout/preferences`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${mpToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
    });

    if (!mpRes.ok) {
      const err = await mpRes.text();
      console.error("MP API error:", err);
      return new Response(JSON.stringify({ error: "Error al crear preferencia MP", detail: err }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const mpData = await mpRes.json();

    const orderItems = body.items.map(item => {
      const p = productMap.get(String(item.product_id))!;
      return `('${orderId}', '${String(p.id)}', '${p.title.replace(/'/g, "''")}', ${item.quantity}, ${p.price}, ${Math.round(p.price * item.quantity * 100) / 100})`;
    });

    await db.batch([
      db.prepare(
        "INSERT INTO orders (id, customer_name, customer_email, customer_phone, customer_address, total, status, mp_preference_id, payment_method) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, 'mercadopago')"
      ).bind(orderId, body.customer.name, body.customer.email, body.customer.phone || null, body.customer.address || null, total, mpData.id),
      db.prepare(
        `INSERT INTO order_items (order_id, product_id, product_title, quantity, unit_price, subtotal) VALUES ${orderItems.join(", ")}`
      ),
    ]);

    return new Response(JSON.stringify({
      order_id: orderId,
      preference_id: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Checkout error:", err);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
