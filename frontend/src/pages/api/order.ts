import type { APIRoute } from "astro";
import { getActivePromotions, computePromoDiscount, getActiveB2bRules } from "../../lib/d1";
import { getUserFromRequest, getJwtSecret } from "../../lib/auth";
import { getB2bPrice, isApprovedB2bUser } from "../../lib/b2b";

// POST /api/order — crea un pedido con pago por transferencia bancaria o
// efectivo (sin Mercado Pago). Mismas reglas de precio que /api/checkout
// (promos + precio mayorista solo para cuentas B2B aprobadas).
export const POST: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;

  let body: {
    items?: { product_id: string; quantity: number; promo_price?: number }[];
    customer?: { name: string; email: string; phone?: string; address?: string };
    payment_method?: string;
    coupon_id?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const paymentMethod = String(body.payment_method || "");
  if (paymentMethod !== "transferencia" && paymentMethod !== "efectivo") {
    return new Response(JSON.stringify({ error: "Método de pago inválido. Usá transferencia o efectivo." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!body.items?.length || !body.customer?.name || !body.customer?.email) {
    return new Response(JSON.stringify({ error: "Faltan datos: items, customer.name, customer.email" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    const ids = body.items.map(i => i.product_id);
    const placeholders = ids.map(() => "?").join(",");

    let products: any[] = [];
    try {
      const { results } = await DB.prepare(
        `SELECT id, title, price, category_id, category_name, available_qty, thumbnail, slug FROM products WHERE id IN (${placeholders}) AND status = 'published'`
      ).bind(...ids).all();
      products = results;
    } catch (e) {
      console.error("Error fetching products for order:", e);
    }
    const productMap = new Map((products || []).map(p => [String(p.id), p]));

    const promotions = await getActivePromotions(DB);

    let sessionUser;
    let b2bApproved = false;
    let b2bRules: any[] = [];
    try {
      sessionUser = await getUserFromRequest(request, DB, getJwtSecret((locals.runtime as any).env ?? {}));
      b2bApproved = isApprovedB2bUser(sessionUser as any);
      if (b2bApproved) b2bRules = await getActiveB2bRules(DB);
    } catch (e) {
      console.error("B2B auth/rules error:", e);
    }

    const orderId = crypto.randomUUID();
    const orderItemsData: {
      product_id: string; product_title: string; quantity: number;
      unit_price: number; subtotal: number; discount_amount: number; promo_id: string | null;
    }[] = [];
    let total = 0;
    let totalQty = 0;

    for (const item of body.items) {
      const product = productMap.get(String(item.product_id));
      if (!product) {
        return new Response(JSON.stringify({ error: `Producto no encontrado: ${item.product_id}` }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      if (product.available_qty < item.quantity) {
        return new Response(JSON.stringify({ error: `Stock insuficiente: ${product.title}` }), { status: 400, headers: { "Content-Type": "application/json" } });
      }

      let unitPrice = product.price;
      let discountAmount = 0;
      let promoId: string | null = null;

      const promoResult = computePromoDiscount(promotions, product.id, product.category_id, product.price);
      if (promoResult && promoResult.promoPrice < unitPrice) {
        discountAmount = (unitPrice - promoResult.promoPrice) * item.quantity;
        unitPrice = promoResult.promoPrice;
        promoId = promotions.find(p => p.name === promoResult.promoName)?.id ?? null;
      }

      if (b2bApproved) {
        const b2b = getB2bPrice(b2bRules, product.category_name, product.price);
        if (b2b && item.quantity >= b2b.minQuantity && b2b.price < unitPrice) {
          discountAmount += (unitPrice - b2b.price) * item.quantity;
          unitPrice = b2b.price;
        }
      }

      const subtotal = Math.round(unitPrice * item.quantity * 100) / 100;
      total += subtotal;
      totalQty += item.quantity;

      orderItemsData.push({
        product_id: product.id,
        product_title: product.title,
        quantity: item.quantity,
        unit_price: unitPrice,
        subtotal,
        discount_amount: discountAmount,
        promo_id: promoId,
      });
    }

    total = Math.round(total * 100) / 100;
    const firstProduct = productMap.get(String(body.items[0].product_id))!;

    const batchStatements = [
      DB.prepare(
        "INSERT INTO orders (id, product_id, quantity, unit_price, total_price, payment_method, status, customer_name, customer_email, customer_phone) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)"
      ).bind(orderId, firstProduct.id, totalQty, orderItemsData[0].unit_price, total, paymentMethod, body.customer.name, body.customer.email, body.customer.phone || null),
    ];

    for (const item of orderItemsData) {
      batchStatements.push(
        DB.prepare(
          "INSERT INTO order_items (order_id, product_id, product_title, quantity, unit_price, subtotal, discount_amount, promo_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(orderId, item.product_id, item.product_title, item.quantity, item.unit_price, item.subtotal, item.discount_amount, item.promo_id)
      );
    }

    if (body.coupon_id) {
      batchStatements.push(
        DB.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?").bind(body.coupon_id)
      );
    }

    await DB.batch(batchStatements);

    return new Response(JSON.stringify({ order_id: orderId, payment_method: paymentMethod, total }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Order create error:", err?.message, err?.stack);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};

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
