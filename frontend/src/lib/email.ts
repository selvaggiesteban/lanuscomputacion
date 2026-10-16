// email.ts
// Transactional email via Gmail SMTP (Logic moved to Backend Worker)
// The frontend only defines templates to avoid build errors with "cloudflare:sockets".

export interface EmailEnv {
  GMAIL_USER?: string;
  GMAIL_APP_PASSWORD?: string;
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

const FROM_NAME = "Lanús Computación";

// --- Email Templates (Preserved for Backend usage) ---

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

export function orderConfirmationEmail(order: {
  orderId: number;
  items: { title: string; quantity: number; price: number }[];
  total: number;
  customerName: string;
}): string {
  const itemsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td>${item.title}</td>
      <td style="text-align:center">${item.quantity}</td>
      <td style="text-align:right">$${(item.price * item.quantity).toLocaleString("es-AR")}</td>
    </tr>`
    )
    .join("");

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
          <h2>¡Gracias por tu compra, ${order.customerName}!</h2>
          <p>Tu pedido <strong>#${order.orderId}</strong> fue registrado exitosamente.</p>
          <table>
            <thead>
              <tr style="border-bottom:2px solid #333">
                <td style="text-align:left"><strong>Producto</strong></td>
                <td style="text-align:center"><strong>Cant.</strong></td>
                <td style="text-align:right"><strong>Precio</strong></td>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr>
                <td colspan="2" class="total">Total</td>
                <td style="text-align:right" class="total">$${order.total.toLocaleString("es-AR")}</td>
              </tr>
            </tbody>
          </table>
          <p style="margin-top:24px">Te notificaremos cuando tu pedido sea despachado.</p>
          <a href="https://lanuscomputacion.com/compras" class="btn">Ver mi pedido</a>
        </div>
        <div class="footer">
          <p>Lanús Computación · lanuscomputacion.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export function orderStatusEmail(order: {
  orderId: number;
  status: string;
  customerName: string;
}): string {
  const statusLabels: Record<string, string> = {
    pending: "Pendiente de pago",
    paid: "Pago confirmado",
    processing: "En preparación",
    shipped: "Despachado",
    delivered: "Entregado",
    cancelled: "Cancelado",
  };

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
          <h2>Actualización de tu pedido #${order.orderId}</h2>
          <p>Hola ${order.customerName},</p>
          <p>El estado de tu pedido cambió a: <strong>${statusLabels[order.status] || order.status}</strong></p>
          <a href="https://lanuscomputacion.com/compras" class="btn">Ver mi pedido</a>
        </div>
        <div class="footer">
          <p>Lanús Computación · lanuscomputacion.com</p>
        </div>
      </div>
    </body>
    </html>
  `;
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

// The actual sending logic must reside in the Backend Worker, not in the static frontend.
export async function sendEmail(env: EmailEnv, options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  return { success: false, error: "Sending emails directly from static frontend is not supported. Please use the Backend API." };
}
