import type { APIRoute } from "astro";
import { getActivePromotions, computePromoDiscount, incrementCouponUsage, getStoreConfig } from "../../lib/d1";

const MP_API = "https://api.mercadopago.com";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const mpToken = locals.runtime.env.MP_ACCESS_TOKEN as string;

  if (!mpToken) {
    return new Response(JSON.stringify({ error: "MercadoPago no configurado" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  let body: {
    items?: { product_id: string; quantity: number; promo_price?: number }[];
    customer?: { name: string; email: string; phone?: string; address?: string };
    coupon_id?: string | null;
  };
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
      `SELECT id, title, price, category_id, available_qty, thumbnail, slug FROM products WHERE id IN (${placeholders}) AND status = 'published'`
    ).bind(...ids).all<{ id: string; title: string; price: number; category_id: string; available_qty: number; thumbnail: string; slug: string }>();

    const productMap = new Map(products.map(p => [String(p.id), p]));

    const promotions = await getActivePromotions(db);
    const config = await getStoreConfig(db);

    const mpItems: any[] = [];
    let total = 0;
    const orderItemsData: {
      product_id: string; product_title: string; quantity: number;
      unit_price: number; subtotal: number; discount_amount: number; promo_id: string | null;
    }[] = [];

    for (const item of body.items) {
      const product = productMap.get(String(item.product_id));
      if (!product) {
        return new Response(JSON.stringify({ error: `Producto no encontrado: ${item.product_id}` }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      if (product.available_qty < item.quantity) {
        return new Response(JSON.stringify({ error: `Stock insuficiente: ${product.title}` }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      let unitPrice = item.promo_price ?? product.price;
      let discountAmount = 0;
      let promoId: string | null = null;

      const promoResult = computePromoDiscount(promotions, product.id, product.category_id, product.price);
      if (promoResult && promoResult.promoPrice < unitPrice) {
        discountAmount = (unitPrice - promoResult.promoPrice) * item.quantity;
        unitPrice = promoResult.promoPrice;
        promoId = promotions.find(p => p.name === promoResult.promoName)?.id ?? null;
      }

      const subtotal = Math.round(unitPrice * item.quantity * 100) / 100;
      total += subtotal;

      orderItemsData.push({
        product_id: product.id,
        product_title: product.title,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
        discount_amount: discountAmount,
        promo_id: promoId,
      });

      mpItems.push({
        id: String(product.id),
        title: product.title,
        quantity: item.quantity,
        unit_price: Math.round(unitPrice * 100) / 100,
        currency_id: "ARS",
        picture_url: product.thumbnail || undefined,
      });
    }

    total = Math.round(total * 100) / 100;

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

    const firstItem = body.items[0];
    const firstProduct = productMap.get(String(firstItem.product_id))!;

    const batchStatements = [
      db.prepare(
        "INSERT INTO orders (id, product_id, unit_price, customer_name, customer_email, customer_phone, total_price, status, mp_preference_id, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, 'mercadopago')"
      ).bind(orderId, firstProduct.id, firstProduct.price, body.customer.name, body.customer.email, body.customer.phone || null, total, mpData.id),
    ];

    for (const item of orderItemsData) {
      batchStatements.push(
        db.prepare(
          "INSERT INTO order_items (order_id, product_id, product_title, quantity, unit_price, subtotal, discount_amount, promo_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(orderId, item.product_id, item.product_title, item.quantity, item.unit_price, item.subtotal, item.discount_amount, item.promo_id)
      );
    }

    if (body.coupon_id) {
      batchStatements.push(
        db.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?").bind(body.coupon_id)
      );
    }

    await db.batch(batchStatements);

    return new Response(JSON.stringify({
      order_id: orderId,
      preference_id: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Checkout error:", err?.message, err?.stack);
    return new Response(JSON.stringify({ error: "Error interno del servidor", detail: err?.message || String(err) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
