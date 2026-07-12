import type { APIRoute } from "astro";
import { verifyResetToken, hashPassword, getJwtSecret } from "../../../lib/auth";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);

  let body: { token?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!body.token || !body.password) {
    return new Response(JSON.stringify({ error: "Faltan token y password" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (body.password.length < 6) {
    return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Verify the JWT token
  const payload = await verifyResetToken(body.token, jwtSecret);
  if (!payload) {
    return new Response(JSON.stringify({ error: "El link es inválido o expiró. Pedí uno nuevo." }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Find user and verify stored token matches
  const user = await db.prepare(
    "SELECT id, password_reset_token, password_reset_expires FROM customers WHERE email = ?"
  ).bind(payload.email).first<{ id: number; password_reset_token: string | null; password_reset_expires: string | null }>();

  if (!user || user.password_reset_token !== body.token) {
    return new Response(JSON.stringify({ error: "El link ya fue utilizado o es inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  // Check expiry from DB
  if (user.password_reset_expires) {
    const expiresAt = new Date(user.password_reset_expires).getTime();
    if (Date.now() > expiresAt) {
      return new Response(JSON.stringify({ error: "El link expiró. Pedí uno nuevo." }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
  }

  // Update password and clear reset token
  const passwordHash = await hashPassword(body.password);
  await db.prepare(
    "UPDATE customers SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?"
  ).bind(passwordHash, user.id).run();

  return new Response(JSON.stringify({ success: true, message: "Contraseña actualizada. Iniciá sesión." }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
