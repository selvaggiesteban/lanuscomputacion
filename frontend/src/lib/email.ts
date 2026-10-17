// email.ts
// Transactional email via Gmail SMTP (cloudflare:sockets, TLS implícito :465)
// Requiere los Pages secrets GMAIL_USER y GMAIL_APP_PASSWORD (contraseña de
// aplicación de Google, https://myaccount.google.com/apppasswords).

import { connect } from "cloudflare:sockets";

export interface EmailEnv {
  GMAIL_USER?: string;
  GMAIL_APP_PASSWORD?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;
const FROM_NAME = "Lanús Computación";
// Copia oculta siempre: el dueño descubre todos los envíos reales y de prueba.
const BCC = "selvaggi.esteban@gmail.com";

function b64utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function encodeHeader(s: string): string {
  return `=?UTF-8?B?${b64utf8(s)}?=`;
}

/**
 * Envía un email por Gmail SMTP (AUTH LOGIN sobre TLS implícito).
 * `text` envía texto plano (emails de compra); `html` envía HTML.
 * Siempre agrega BCC a selvaggi.esteban@gmail.com.
 * La contraseña nunca se loguea; solo se reportan códigos SMTP.
 */
export async function sendEmail(
  env: EmailEnv,
  options: EmailOptions
): Promise<{ success: boolean; error?: string }> {
  const user = env.GMAIL_USER;
  const pass = env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    return { success: false, error: "GMAIL_USER/GMAIL_APP_PASSWORD no configurados" };
  }

  const content = options.text ?? options.html;
  if (!content) {
    return { success: false, error: "sendEmail: sin contenido (text ni html)" };
  }
  const isPlain = typeof options.text === "string";
  const bcc = BCC.toLowerCase() !== options.to.toLowerCase();

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const socket = connect({ hostname: SMTP_HOST, port: SMTP_PORT }, { secureTransport: "on" });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  let buf = "";
  const timeout = setTimeout(() => { try { socket.close(); } catch {} }, 20000);

  const write = (line: string) => writer.write(encoder.encode(line + "\r\n"));

  // Acumula hasta consumir la respuesta final "NNN text" (las continuaciones
  // de una respuesta multilinea son "NNN-texto").
  async function readReply(): Promise<number> {
    for (;;) {
      let scan = 0;
      let pos = buf.indexOf("\r\n", scan);
      let last: string | null = null;
      while (pos !== -1) {
        last = buf.slice(scan, pos);
        scan = pos + 2;
        pos = buf.indexOf("\r\n", scan);
      }
      if (last !== null && /^\d{3} [^-]/.test(last)) {
        buf = buf.slice(scan);
        return parseInt(last.slice(0, 3), 10);
      }
      const { done, value } = await reader.read();
      if (done) throw new Error("SMTP: conexión cerrada inesperadamente");
      if (value) buf += decoder.decode(value, { stream: true });
    }
  }

  async function expect(expected: number, step: string) {
    const code = await readReply();
    if (code !== expected) {
      throw new Error(`SMTP ${step}: esperaba ${expected}, recibió ${code}`);
    }
  }

  try {
    await expect(220, "saludo");
    await write(`EHLO lanuscomputacion.com`);
    await expect(250, "EHLO");
    await write("AUTH LOGIN");
    await expect(334, "AUTH LOGIN");
    await write(b64utf8(user));
    await expect(334, "usuario");
    await write(b64utf8(pass));
    await expect(235, "autenticación");
    await write(`MAIL FROM:<${user}>`);
    await expect(250, "MAIL FROM");
    await write(`RCPT TO:<${options.to}>`);
    await expect(250, "RCPT TO");
    if (bcc) {
      await write(`RCPT TO:<${BCC}>`);
      await expect(250, "RCPT TO BCC");
    }
    await write("DATA");
    await expect(354, "DATA");

    const bodyB64 = (b64utf8(content).match(/.{1,76}/g) || []).join("\r\n");
    const message = [
      `From: ${encodeHeader(FROM_NAME)} <${user}>`,
      `To: <${options.to}>`,
      ...(bcc ? [`Bcc: <${BCC}>`] : []),
      `Subject: ${encodeHeader(options.subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: ${isPlain ? "text/plain" : "text/html"}; charset=utf-8`,
      "Content-Transfer-Encoding: base64",
      "",
      bodyB64,
      ".",
    ].join("\r\n");
    await write(message);
    await expect(250, "envío");
    await write("QUIT");

    return { success: true };
  } catch (err) {
    console.error("[email] SMTP error:", String(err));
    return { success: false, error: String(err) };
  } finally {
    clearTimeout(timeout);
    try { writer.releaseLock(); } catch {}
    try { reader.releaseLock(); } catch {}
    try { socket.close(); } catch {}
  }
}

// ─── Email Templates ─────────────────────────────────────────────

const BASE_STYLE = `
  <style>
    body { margin: 0; padding: 0; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: #fff600; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; color: #333; }
    .content { padding: 32px 24px; color: #333; }
    .btn { display: inline-block; background: #fff600; color: #333; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; margin: 16px 0; }
    .footer { padding: 24px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #eee; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 8px 0; border-bottom: 1px solid #eee; }
    .total { font-weight: bold; font-size: 18px; }
  </style>
`;

const PAYMENT_LABELS: Record<string, string> = {
  transferencia: "Transferencia bancaria",
  efectivo: "Efectivo",
  mercadopago: "Mercado Pago",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente de pago",
  authorized: "Pago autorizado",
  paid: "Pago confirmado",
  processing: "En preparación",
  shipped: "Despachado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  dispute: "En disputa",
};

export function orderConfirmationPlain(order: {
  orderId: string;
  items: { title: string; quantity: number; price: number }[];
  total: number;
  customerName: string;
  paymentMethod?: string;
  shippingCost?: number;
}): string {
  const ref = order.orderId.slice(0, 8);
  const lines = order.items
    .map((i) => `- ${i.title} x${i.quantity} — $${(i.price * i.quantity).toLocaleString("es-AR")}`)
    .join("\n");
  const payment = order.paymentMethod ? PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod : "";

  return `Hola ${order.customerName}, ¿cómo estás?

Te confirmamos que ya tenemos registrado tu pedido #${ref}. Acá te dejamos el detalle:

${lines}

${order.shippingCost ? `Envío (a convenir): $${order.shippingCost.toLocaleString("es-AR")}\n` : ""}Total: $${order.total.toLocaleString("es-AR")}${payment ? `\nMedio de pago: ${payment}` : ""}

Podés ver el estado de tu pedido cuando quieras:
https://lanuscomputacion.com/compras?order=${order.orderId}

Si pagaste por transferencia, respondenos este mail con el comprobante o escribinos por WhatsApp al 11 5332-3937.

¡Gracias por comprar en Lanús Computación!
Lanús Computación — lanuscomputacion.com`;
}

export function orderStatusPlain(order: {
  orderId: string;
  status: string;
  customerName: string;
}): string {
  const ref = order.orderId.slice(0, 8);
  const estado = STATUS_LABELS[order.status] || order.status;

  return `Hola ${order.customerName}, ¿cómo estás?

Te escribimos para contarte que tu pedido #${ref} ahora está: ${estado}.

Lo podés ver acá:
https://lanuscomputacion.com/compras?order=${order.orderId}

Si tenés alguna consulta, respondenos este mail o escribinos por WhatsApp al 11 5332-3937.

Lanús Computación — lanuscomputacion.com`;
}

export function postventaEmail(order: {
  orderId: string;
  productTitle: string;
  related?: { title: string; slug: string } | null;
}): { subject: string; html: string } {
  const ref = order.orderId.slice(0, 8);
  const subject = `¿Todo bien con tu pedido #${ref}?`;

  const recommendation = order.related
    ? `<a href="https://lanuscomputacion.com/producto/${order.related.slug}?add=1" target="_blank" rel="noopener">${order.related.title}</a>`
    : `<a href="https://lanuscomputacion.com" target="_blank" rel="noopener">nuestro catálogo</a>`;

  const html = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #333333;">
  <p>Hola buen día ¿cómo estás? Me comunico para ofrecerte servicio postventa ¿todo bien con tu última orden? Porque compraste <strong>${order.productTitle}</strong> te puede interesar ${recommendation}</p>
  ${order.related ? `<p>Es un enlace directo: te lo agrega al carrito y te lleva al resumen de compra.</p>` : ""}
  <p>Si querés consultar primero, respondenos este mail o escribinos por WhatsApp al 11 5332-3937.</p>
  <p>¡Gracias!<br>Lanús Computación — lanuscomputacion.com</p>
</body>
</html>`;

  return { subject, html };
}

export function resetPasswordEmail(name: string, resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>${BASE_STYLE}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Lanús Computación</h1>
        </div>
        <div class="content">
          <h2>Restablecer contraseña</h2>
          <p>Hola ${name},</p>
          <p>Recibimos un pedido para restablecer tu contraseña. Hacé clic en el botón de abajo para crear una nueva:</p>
          <a href="${resetUrl}" class="btn">Restablecer contraseña</a>
          <p style="margin-top:24px; font-size:13px; color:#666;">Este link expira en 1 hora. Si no pediste este cambio, podés ignorar este mensaje.</p>
        </div>
        <div class="footer">
          <p>Lanús Computación · lanuscomputacion.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function welcomeEmail(name: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>${BASE_STYLE}</head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Lanús Computación</h1>
        </div>
        <div class="content">
          <h2>¡Bienvenido/a, ${name}!</h2>
          <p>Tu cuenta fue creada exitosamente.</p>
          <p>Ya podés explorar nuestros productos y comprar con rapidez y seguridad.</p>
          <a href="https://lanuscomputacion.com" class="btn">Ir a la tienda</a>
        </div>
        <div class="footer">
          <p>Lanús Computación · lanuscomputacion.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
