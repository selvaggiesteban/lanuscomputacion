import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;

  let body: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    cuit?: string;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.name || !body.company || !body.email || !body.phone || !body.cuit) {
    return new Response(JSON.stringify({ error: "Faltan todos los campos requeridos" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Check if email already exists
  const existing = await db.prepare(
    "SELECT id FROM customers WHERE email = ?"
  ).bind(body.email).first();

  if (existing) {
    return new Response(JSON.stringify({ error: "El email ya está registrado. Contactanos para activar tu cuenta mayorista." }), {
      status: 409,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create B2B customer (pending approval)
  await db.prepare(`
    INSERT INTO customers (email, name, phone, is_b2b, b2b_status, created_at)
    VALUES (?, ?, ?, 1, 'pending', datetime('now'))
  `).bind(body.email, `${body.name} (${body.company})`, body.phone).run();

  return new Response(JSON.stringify({
    success: true,
    message: "Solicitud enviada. Te contactaremos en 24-48 hs hábiles.",
  }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};
