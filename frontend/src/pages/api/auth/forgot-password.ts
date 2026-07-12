import type { APIRoute } from "astro";
import { generateResetToken, getJwtSecret } from "../../../lib/auth";
import { checkRateLimit, getClientIp } from "../../../lib/rate-limit";
import { sendEmail, resetPasswordEmail } from "../../../lib/email";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const resendApiKey = locals.runtime.env.RESEND_API_KEY as string | undefined;

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`reset-password:${ip}`, 5, 300000);
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Demasiados intentos. Intentá de nuevo en unos minutos." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(rateLimit.resetIn) },
    });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!body.email) {
    return new Response(JSON.stringify({ error: "Ingresá tu email" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Always return success to prevent email enumeration
  const successResponse = new Response(JSON.stringify({ success: true, message: "Si el email está registrado, vas a recibir un link para restablecer tu contraseña." }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  const user = await db.prepare(
    "SELECT id, email, name, password_hash FROM customers WHERE email = ?"
  ).bind(body.email).first<{ id: number; email: string; name: string; password_hash: string | null }>();

  // Don't reveal if user exists
  if (!user || !user.password_hash) {
    return successResponse;
  }

  // Generate reset token
  const token = await generateResetToken(user.email, jwtSecret);

  // Store token hash and expiry in DB
  await db.prepare(
    "UPDATE customers SET password_reset_token = ?, password_reset_expires = datetime('now', '+1 hour') WHERE id = ?"
  ).bind(token, user.id).run();

  // Send reset email (non-blocking)
  if (resendApiKey) {
    const resetUrl = `https://lanuscomputacion.com/restablecer-contrasena?token=${token}`;
    sendEmail(resendApiKey, {
      to: user.email,
      subject: "Restablecer contraseña — Lanús Computación",
      html: resetPasswordEmail(user.name, resetUrl),
    }).catch(console.error);
  }

  return successResponse;
};
