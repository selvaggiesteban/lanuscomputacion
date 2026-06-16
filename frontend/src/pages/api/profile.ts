import type { APIRoute } from "astro";
import { getUserFromRequest } from "../../../lib/auth";

export const POST: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = locals.runtime.env.JWT_SECRET as string;
  const user = await getUserFromRequest(request, db, jwtSecret);

  if (!user) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: { name?: string; email?: string; phone?: string; address?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const updates: string[] = [];
  const binds: any[] = [];

  if (body.name) { updates.push("name = ?"); binds.push(body.name); }
  if (body.email) { updates.push("email = ?"); binds.push(body.email); }
  if (body.phone !== undefined) { updates.push("phone = ?"); binds.push(body.phone); }
  if (body.address !== undefined) { updates.push("address = ?"); binds.push(body.address); }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: "Sin cambios" }), { status: 400 });
  }

  binds.push(user.id);
  await db.prepare(`UPDATE customers SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
