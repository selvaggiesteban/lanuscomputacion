import type { APIRoute } from "astro";
import { hashPassword, generateToken, createSessionCookie, generateId } from "../../../lib/auth";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = locals.runtime.env.JWT_SECRET as string;

  if (!jwtSecret) {
    return new Response(JSON.stringify({ error: "JWT_SECRET no configurado" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { name?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.name || !body.email || !body.password) {
    return new Response(JSON.stringify({ error: "Faltan datos: name, email, password" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check if user already exists
  const existing = await db.prepare(
    "SELECT id FROM customers WHERE email = ?"
  ).bind(body.email).first();

  if (existing) {
    return new Response(JSON.stringify({ error: "El email ya está registrado" }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create user
  const userId = generateId();
  const passwordHash = await hashPassword(body.password);

  await db.prepare(`
    INSERT INTO customers (id, email, name, password_hash, is_admin, is_b2b, created_at)
    VALUES (?, ?, ?, ?, 0, 0, datetime('now'))
  `).bind(userId, body.email, body.name, passwordHash).run();

  // Generate token
  const token = await generateToken(
    { userId, email: body.email, isAdmin: false },
    jwtSecret
  );

  const cookie = createSessionCookie(token);

  return new Response(JSON.stringify({
    success: true,
    user: { id: userId, name: body.name, email: body.email },
  }), {
    status: 201,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
};
