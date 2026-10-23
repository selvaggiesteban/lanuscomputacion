import type { APIRoute } from "astro";
import { MeliClient } from "../../../lib/meli";
import { logMeliEvent } from "../../../lib/d1";

// POST /api/webhook/ml-sales — notificaciones de Mercado Libre (orders_v2).
// Auth: query param ?token=<DIGEST_TOKEN>. Las notificaciones de topics de ML
// NO traen firma HMAC (x-signature ts=/v1= es exclusivo de Mercado Pago):
// https://developers.mercadolibre.com.ar/en_us/products-receive-notifications
// El token es el mismo que registra POST /api/meli/hooks en el callback URL.
// Idempotencia por orders.source='mercadolibre' + orders.external_id (migración 024).

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

interface MlOrderItem {
  item?: { id?: string; title?: string };
  quantity?: number;
  unit_price?: number;
  unit_discount?: number;
  currency_id?: string;
}

interface MlOrder {
  id: number | string;
  status?: string;
  status_detail?: string;
  total_amount?: number;
  currency_id?: string;
  date_closed?: string | null;
  buyer?: { id?: number; nickname?: string; email?: string; first_name?: string; last_name?: string };
  order_items?: MlOrderItem[];
  payments?: { status?: string }[];
  tags?: string[];
}

const STATUS_MAP: Record<string, string> = {
  paid: "paid",
  cancelled: "cancelled",
  payment_required: "pending",
  pending: "pending",
  partially_paid: "pending",
  blocked: "processing",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ locals, request }) => {
  const env = locals.runtime.env as {
    DB: D1Database;
    ML_CLIENT_ID?: string;
    ML_CLIENT_SECRET?: string;
    DIGEST_TOKEN?: string;
  };
  const db = env.DB;

  if (!env.DIGEST_TOKEN) {
    return json(503, { error: "DIGEST_TOKEN no configurado" });
  }

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  if (!token || !timingSafeEqual(token, env.DIGEST_TOKEN)) {
    return json(401, { error: "Token inválido" });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  // Formatos soportados: legacy notification {topic, resource, user_id} y
  // orders_v2 (mismo shape con resource "/orders/<id>"). Benigno → 200.
  const topic: string | undefined = body?.topic;
  const resource: string | undefined = body?.resource;
  const orderIdMatch = resource?.match(/\/orders\/(\d+)/);

  // Solo procesamos topics de órdenes; el resto se ignora benignamente
  if (!orderIdMatch || (topic && !/^orders(_v2)?$/.test(topic))) {
    await logMeliEvent(db, {
      eventType: "webhook_ignored",
      entity: "notification",
      status: "ignored",
      message: `Notificación ignorada (topic=${topic ?? "n/a"}, resource=${resource ?? "n/a"})`,
      payload: JSON.stringify(body ?? {}),
    }).catch(() => {});
    return json(200, { ignored: true });
  }

  const orderId = orderIdMatch[1];
  const externalId = String(orderId);

  try {
    // Idempotencia: si ya existe la orden de este evento, no repetir nada
    const existing = await db.prepare(
      "SELECT id FROM orders WHERE source = 'mercadolibre' AND external_id = ?"
    ).bind(externalId).first<{ id: string }>().catch(() => null);
    if (existing) {
      return json(200, { ok: true, duplicate: true, orderId: existing.id });
    }

    const client = new MeliClient(db, env.ML_CLIENT_ID ?? "", env.ML_CLIENT_SECRET ?? "");
    const order = await client.request<MlOrder>(`/orders/${externalId}`);

    const items = order.order_items || [];
    const firstItem = items[0];
    const buyer = order.buyer || {};
    const total = Number(order.total_amount ?? items.reduce((sum, it) => sum + (it.unit_price ?? 0) * (it.quantity ?? 0), 0)) || 0;
    const localStatus = STATUS_MAP[order.status || ""] || "pending";
    const customerName = [buyer.first_name, buyer.last_name].filter(Boolean).join(" ") || buyer.nickname || "Cliente Mercado Libre";
    const localOrderId = crypto.randomUUID();

    // Producto local vinculado por ml_item_id; si no existe, placeholder
    // reportable (orders.product_id es NOT NULL y puede violar el FK).
    const resolveProductId = async (mlItemId?: string): Promise<string> => {
      if (!mlItemId) return "ml-desconocido";
      const p = await db.prepare("SELECT id FROM products WHERE ml_item_id = ?").bind(mlItemId).first<{ id: string }>().catch(() => null);
      return p?.id || `ml-${mlItemId}`;
    };
    const firstProductId = await resolveProductId(firstItem?.item?.id);

    const orderRow = {
      id: localOrderId,
      product_id: firstProductId,
      quantity: items.reduce((sum, it) => sum + (it.quantity ?? 0), 0) || 1,
      unit_price: firstItem?.unit_price ?? total,
      total_price: total,
      status: localStatus,
      customer_name: customerName,
      customer_email: buyer.email ?? null,
      address: null,
    };

    let created = false;
    try {
      await db.prepare(
        `INSERT INTO orders (id, product_id, quantity, unit_price, total_price, status,
                             customer_name, customer_email, address, payment_method, source, external_id, paid_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'mercadolibre', 'mercadolibre', ?, ?, datetime('now'))
         ON CONFLICT(id) DO NOTHING`
      ).bind(
        orderRow.id, orderRow.product_id, orderRow.quantity, orderRow.unit_price, orderRow.total_price,
        orderRow.status, orderRow.customer_name, orderRow.customer_email, orderRow.address,
        externalId,
        localStatus === "paid" ? (order.date_closed ?? new Date().toISOString()) : null
      ).run();
      created = true;
    } catch (e: any) {
      // Migración 024 (source/external_id) puede no estar aplicada todavía
      console.error("ML order insert with source/external_id failed, retrying basic:", e?.message);
      await db.prepare(
        `INSERT INTO orders (id, product_id, quantity, unit_price, total_price, status,
                             customer_name, customer_email, address, payment_method, paid_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'mercadolibre', ?, datetime('now'))
         ON CONFLICT(id) DO NOTHING`
      ).bind(
        orderRow.id, orderRow.product_id, orderRow.quantity, orderRow.unit_price, orderRow.total_price,
        orderRow.status, orderRow.customer_name, orderRow.customer_email, orderRow.address,
        localStatus === "paid" ? (order.date_closed ?? new Date().toISOString()) : null
      ).run();
      created = true;
      await logMeliEvent(db, {
        eventType: "order_insert_fallback",
        entity: "order",
        entityId: externalId,
        status: "warning",
        message: "orders.source/external_id no disponibles (migración 024 pendiente)",
        payload: JSON.stringify(order),
      }).catch(() => {});
    }

    if (created) {
      for (const it of items) {
        const mlItemId = it.item?.id;
        const quantity = it.quantity ?? 1;
        const unitPrice = it.unit_price ?? 0;
        const discount = it.unit_discount ?? 0;
        const productId = await resolveProductId(mlItemId);

        await db.prepare(
          "INSERT INTO order_items (order_id, product_id, product_title, quantity, unit_price, subtotal, discount_amount, promo_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          localOrderId, productId, it.item?.title ?? "Producto Mercado Libre",
          quantity, unitPrice, Math.round(unitPrice * quantity * 100) / 100, discount, null
        ).run().catch((e: any) => console.error("ML order_items insert error:", e?.message));

        // Stock solo si la orden recién se creó (idempotente ante reintentos)
        if (mlItemId) {
          await db.prepare(
            "UPDATE products SET available_qty = available_qty - ? WHERE ml_item_id = ?"
          ).bind(quantity, mlItemId).run().catch((e: any) => console.error("ML stock update error:", e?.message));
        }
      }

      await logMeliEvent(db, {
        eventType: "sale",
        entity: "order",
        entityId: externalId,
        status: "created",
        message: `Venta ML ${externalId}: ${orderRow.status}, total ${orderRow.total_price}`,
        payload: JSON.stringify(order),
      }).catch(() => {});
    }

    return json(200, { ok: true, orderId: localOrderId, mlOrderId: externalId, status: localStatus });
  } catch (error: any) {
    console.error("ML webhook processing error:", error?.message || String(error));
    await logMeliEvent(db, {
      eventType: "webhook_error",
      entity: "order",
      entityId: externalId,
      status: "error",
      message: error?.message || String(error),
      payload: JSON.stringify(body ?? {}),
    }).catch(() => {});
    // 5xx para que ML reintente (hasta 1 h con intervalos de 1 h)
    return json(500, { error: "Error procesando la notificación" });
  }
};
