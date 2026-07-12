import type { APIRoute } from "astro";
import { verifyPassword, generateToken, createSessionCookie, getJwtSecret } from "../../../lib/auth";
import { checkRateLimit, getClientIp } from "../../../lib/rate-limit";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);

  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`login:${ip}`, 10, 60000); // 10 attempts per minute
  if (!rateLimit.allowed) {
    return new Response(JSON.stringify({ error: "Demasiados intentos. Intentá de nuevo en un minuto." }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(rateLimit.resetIn) },
    });
  }

  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.email || !body.password) {
    return new Response(JSON.stringify({ error: "Faltan datos: email, password" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Find user
  const user = await db.prepare(
    "SELECT * FROM customers WHERE email = ?"
  ).bind(body.email).first<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
    is_admin: number;
  }>();

  if (!user || !user.password_hash) {
    return new Response(JSON.stringify({ error: "Email o contraseña incorrectos" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Verify password
  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Email o contraseña incorrectos" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Generate token
  const token = await generateToken(
    { userId: user.id, email: user.email, isAdmin: user.is_admin === 1 },
    jwtSecret
  );

  const cookie = createSessionCookie(token);

  return new Response(JSON.stringify({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin === 1 },
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
};
