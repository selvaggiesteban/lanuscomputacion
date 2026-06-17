import type { APIRoute } from "astro";
import { sendEmail, orderConfirmationEmail, orderStatusEmail } from "../../../lib/email";

const MP_API = "https://api.mercadopago.com";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const mpToken = locals.runtime.env.MP_ACCESS_TOKEN as string;
  const resendApiKey = locals.runtime.env.RESEND_API_KEY as string | undefined;

  if (!mpToken) {
    return new Response(JSON.stringify({ error: "MP no configurado" }), { status: 500 });
  }

  const url = new URL(request.url);
  let paymentId = url.searchParams.get("id") || url.searchParams.get("data.id");
  let topic = url.searchParams.get("topic") || url.searchParams.get("type");

  if (!paymentId && request.body) {
    try {
      const json = await request.json();
      paymentId = json?.data?.id || json?.id;
      topic = json?.action?.replace(".created", "").replace(".updated", "") || topic;
    } catch {}
  }

  if (!paymentId || topic !== "payment") {
    return new Response("OK", { status: 200 });
  }

  const mpRes = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { "Authorization": `Bearer ${mpToken}` },
  });

  if (!mpRes.ok) {
    return new Response("Error fetching payment", { status: 502 });
  }

  const payment = await mpRes.json();
  const orderId = payment.external_reference;
  const mpPaymentId = String(payment.id);
  const status = payment.status;

  if (!orderId) {
    return new Response("No external reference", { status: 200 });
  }

  const statusMap: Record<string, string> = {
    approved: "paid",
    rejected: "cancelled",
    cancelled: "cancelled",
    refunded: "refunded",
    charged_back: "dispute",
    in_process: "processing",
    pending: "pending",
    authorized: "authorized",
  };

  const localStatus = statusMap[status] || "unknown";

  await db.prepare(
    "UPDATE orders SET status = ?, mp_payment_id = ?, payment_id = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(localStatus, mpPaymentId, mpPaymentId, orderId).run();

  if (localStatus === "paid") {
    const { results: items } = await db.prepare(
      "SELECT product_id, quantity FROM order_items WHERE order_id = ?"
    ).bind(orderId).all<{ product_id: string; quantity: number }>();

    if (items) {
      const stmts = items.map(item =>
        db.prepare("UPDATE products SET available_qty = available_qty - ?, sold_qty = sold_qty + ? WHERE id = ? AND available_qty >= ?")
          .bind(item.quantity, item.quantity, item.product_id, item.quantity)
      );
      await db.batch(stmts);
    }

    // Send order confirmation email
    if (resendApiKey) {
      const order = await db.prepare(
        "SELECT * FROM orders WHERE id = ?"
      ).bind(orderId).first<{ customer_name: string; customer_email: string; total: number }>();

      const orderItems = await db.prepare(
        "SELECT product_title, quantity, unit_price FROM order_items WHERE order_id = ?"
      ).bind(orderId).all<{ product_title: string; quantity: number; unit_price: number }>();

      if (order && orderItems.length > 0) {
        const html = orderConfirmationEmail({
          orderId: orderId as unknown as number,
          items: orderItems.map(i => ({ title: i.product_title, quantity: i.quantity, price: i.unit_price })),
          total: order.total,
          customerName: order.customer_name,
        });
        await sendEmail(resendApiKey, {
          to: order.customer_email,
          subject: `Confirmación de pedido #${orderId}`,
          html,
        });
      }
    }
  } else if (["cancelled", "refunded", "shipped", "delivered"].includes(localStatus)) {
    // Send status update email
    if (resendApiKey) {
      const order = await db.prepare(
        "SELECT * FROM orders WHERE id = ?"
      ).bind(orderId).first<{ customer_name: string; customer_email: string }>();

      if (order) {
        const html = orderStatusEmail({
          orderId: orderId as unknown as number,
          status: localStatus,
          customerName: order.customer_name,
        });
        await sendEmail(resendApiKey, {
          to: order.customer_email,
          subject: `Actualización de tu pedido #${orderId}`,
          html,
        });
      }
    }
  }

  return new Response("OK", { status: 200 });
};
