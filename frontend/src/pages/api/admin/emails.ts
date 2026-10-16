import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../../lib/auth";
import { sendEmail, orderConfirmationPlain, orderStatusPlain } from "../../../lib/email";
import { markEmailSent, type EmailTemplate } from "../../../lib/emaillog";
import { ensurePostventaRecord } from "../../../lib/postventa";

const PREVIEW_EMAIL = "selvaggi.esteban@gmail.com";
const REF = (id: string) => id.slice(0, 8);

// POST /api/admin/emails — envío manual de plantillas transaccionales del
// flujo de compra desde /admin/orders. { order_id, template, preview? }
// templates: confirmation | status_update | postventa
export const POST: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);
  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  let body: { order_id?: string; template?: string; preview?: boolean };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const template = String(body.template || "") as EmailTemplate | "postventa";
  if (!body.order_id || !["confirmation", "status_update", "postventa"].includes(template)) {
    return new Response(JSON.stringify({ error: "order_id o template inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const emailEnv = (locals.runtime as any).env as { GMAIL_USER?: string; GMAIL_APP_PASSWORD?: string };
  if (!emailEnv.GMAIL_USER || !emailEnv.GMAIL_APP_PASSWORD) {
    return new Response(JSON.stringify({ error: "Gmail no configurado (GMAIL_USER/GMAIL_APP_PASSWORD)" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  try {
    const order = await DB.prepare(
      "SELECT id, status, customer_name, customer_email, payment_method FROM orders WHERE id = ?"
    ).bind(body.order_id).first<{ id: string; status: string; customer_name: string; customer_email: string; payment_method: string }>();
    if (!order) {
      return new Response(JSON.stringify({ error: "Orden no encontrada" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const preview = Boolean(body.preview);
    let subject = "";
    let content: string;
    let isPlain = true;

    if (template === "confirmation") {
      const { results: items } = await DB.prepare(
        "SELECT product_title, quantity, unit_price FROM order_items WHERE order_id = ?"
      ).bind(order.id).all<{ product_title: string; quantity: number; unit_price: number }>();
      if (!items || items.length === 0) {
        return new Response(JSON.stringify({ error: "La orden no tiene items" }), { status: 400, headers: { "Content-Type": "application/json" } });
      }
      const total = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
      subject = `Confirmación de pedido #${REF(order.id)}`;
      content = orderConfirmationPlain({
        orderId: order.id,
        items: items.map((i) => ({ title: i.product_title, quantity: i.quantity, price: i.unit_price })),
        total: Math.round(total * 100) / 100,
        customerName: order.customer_name,
        paymentMethod: order.payment_method,
      });
    } else if (template === "status_update") {
      subject = `Actualización de tu pedido #${REF(order.id)}`;
      content = orderStatusPlain({
        orderId: order.id,
        status: order.status,
        customerName: order.customer_name,
      });
    } else {
      await ensurePostventaRecord(DB, order.id);
      const record = await DB.prepare(
        "SELECT subject, body, status FROM postventa_emails WHERE order_id = ?"
      ).bind(order.id).first<{ subject: string; body: string; status: string }>();
      if (!record) {
        return new Response(JSON.stringify({ error: "No se pudo generar el registro de postventa" }), { status: 500, headers: { "Content-Type": "application/json" } });
      }
      if (record.status === "sent" && !preview) {
        return new Response(JSON.stringify({ success: true, already: true, template, status: "sent" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      subject = record.subject;
      content = record.body;
      isPlain = false;
    }

    const to = preview ? PREVIEW_EMAIL : order.customer_email;
    const finalSubject = preview ? `[PREVIEW] ${subject}` : subject;
    const result = await sendEmail(emailEnv, {
      to,
      subject: finalSubject,
      ...(isPlain ? { text: content } : { html: content }),
    });
    if (!result.success) {
      return new Response(JSON.stringify({ error: `Fallo SMTP: ${result.error}` }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    if (!preview) {
      if (template === "postventa") {
        await DB.prepare(
          "UPDATE postventa_emails SET status = 'sent', sent_at = datetime('now') WHERE order_id = ?"
        ).bind(order.id).run();
      } else {
        await markEmailSent(DB, order.id, template, subject);
      }
    }

    return new Response(
      JSON.stringify({ success: true, template, preview, sent_to: to }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[admin/emails] error:", e);
    return new Response(JSON.stringify({ error: "Error interno al enviar" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
