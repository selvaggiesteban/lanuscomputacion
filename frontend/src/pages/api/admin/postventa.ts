import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../../lib/auth";
import { sendEmail } from "../../../lib/email";
import { ensurePostventaRecord, backfillPostventa } from "../../../lib/postventa";

async function requireAdmin(locals: any, request: Request) {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);
  if (!user || !user.is_admin) return null;
  return DB;
}

const PREVIEW_EMAIL = "selvaggi.esteban@gmail.com";

export const POST: APIRoute = async ({ locals, request }) => {
  const DB = await requireAdmin(locals, request);
  if (!DB) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403, headers: { "Content-Type": "application/json" } });
  }

  let body: { order_id?: string; preview?: boolean; action?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const emailEnv = (locals.runtime as any).env as { GMAIL_USER?: string; GMAIL_APP_PASSWORD?: string };

  if (body.action === "backfill") {
    try {
      const created = await backfillPostventa(DB);
      const { count } = (await DB.prepare("SELECT COUNT(*) as count FROM postventa_emails").first<{ count: number }>()) ?? { count: 0 };
      const pending = (await DB.prepare("SELECT COUNT(*) as count FROM postventa_emails WHERE status = 'pending'").first<{ count: number }>())?.count ?? 0;
      return new Response(JSON.stringify({ success: true, created, total: count, pending }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch (e) {
      console.error("[postventa] backfill error:", e);
      return new Response(JSON.stringify({ error: "Error en backfill" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  if (!body.order_id) {
    return new Response(JSON.stringify({ error: "order_id requerido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!emailEnv.GMAIL_USER || !emailEnv.GMAIL_APP_PASSWORD) {
    return new Response(JSON.stringify({ error: "Gmail no configurado (GMAIL_USER/GMAIL_APP_PASSWORD)" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  try {
    await ensurePostventaRecord(DB, body.order_id);

    const order = await DB.prepare(
      "SELECT id, customer_name, customer_email FROM orders WHERE id = ?"
    ).bind(body.order_id).first<{ id: string; customer_name: string; customer_email: string }>();
    if (!order) {
      return new Response(JSON.stringify({ error: "Orden no encontrada" }), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const record = await DB.prepare(
      "SELECT * FROM postventa_emails WHERE order_id = ?"
    ).bind(body.order_id).first<any>();

    if (!record) {
      return new Response(JSON.stringify({ error: "No se pudo generar el registro de postventa" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    if (record.status === "sent" && !body.preview) {
      return new Response(JSON.stringify({ success: true, already: true, status: "sent" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const preview = Boolean(body.preview);
    const to = preview ? PREVIEW_EMAIL : order.customer_email;
    const subject = preview ? `[PREVIEW] ${record.subject}` : record.subject;

    const result = await sendEmail(emailEnv, { to, subject, html: record.body });
    if (!result.success) {
      return new Response(JSON.stringify({ error: `Fallo SMTP: ${result.error}` }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    if (!preview) {
      await DB.prepare(
        "UPDATE postventa_emails SET status = 'sent', sent_at = datetime('now') WHERE order_id = ?"
      ).bind(body.order_id).run();
    }

    return new Response(JSON.stringify({ success: true, preview, status: preview ? record.status : "sent", sent_to: to }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[postventa] send error:", e);
    return new Response(JSON.stringify({ error: "Error interno al enviar" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
