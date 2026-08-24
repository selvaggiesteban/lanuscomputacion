import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../../lib/auth";

function generatePromoId(): string {
  return `promo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function requireAdmin(locals: any, request: Request) {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, db, jwtSecret);
  if (!user || !user.is_admin) return null;
  return { db, user };
}

export const GET: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  const { db } = auth;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const activeOnly = url.searchParams.get("active") === "true";

  if (id) {
    const promo = await db.prepare("SELECT * FROM promotions WHERE id = ?").bind(id).first();
    return new Response(JSON.stringify({ promo }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  let query = "SELECT * FROM promotions";
  const conditions: string[] = [];

  if (activeOnly) {
    conditions.push("is_active = 1");
    conditions.push("(start_date IS NULL OR start_date <= datetime('now'))");
    conditions.push("(end_date IS NULL OR end_date >= datetime('now'))");
  }

  if (conditions.length > 0) query += " WHERE " + conditions.join(" AND ");
  query += " ORDER BY created_at DESC";

  const { results: promos } = await db.prepare(query).all();

  return new Response(JSON.stringify({ promos }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  const { db } = auth;

  let body: any;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  if (!body.name || !body.type || body.value === undefined || !body.applies_to) {
    return new Response(JSON.stringify({ error: "Faltan campos requeridos: name, type, value, applies_to" }), { status: 400 });
  }

  if (!["percentage", "fixed"].includes(body.type)) {
    return new Response(JSON.stringify({ error: "type debe ser 'percentage' o 'fixed'" }), { status: 400 });
  }

  if (!["all", "category", "product"].includes(body.applies_to)) {
    return new Response(JSON.stringify({ error: "applies_to debe ser 'all', 'category' o 'product'" }), { status: 400 });
  }

  const id = generatePromoId();

  await db.prepare(`
    INSERT INTO promotions (id, name, type, value, applies_to, target_id, start_date, end_date, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    id,
    body.name,
    body.type,
    body.value,
    body.applies_to,
    body.target_id || null,
    body.start_date || null,
    body.end_date || null,
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
  ).run();

  return new Response(JSON.stringify({ success: true, id }), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
};

export const PUT: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  const { db } = auth;

  let body: any;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  if (!body.id) {
    return new Response(JSON.stringify({ error: "Falta id" }), { status: 400 });
  }

  const updates: string[] = [];
  const binds: any[] = [];

  for (const field of ["name", "type", "value", "applies_to", "target_id", "start_date", "end_date"]) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      binds.push(body[field]);
    }
  }

  if (body.is_active !== undefined) {
    updates.push("is_active = ?");
    binds.push(body.is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: "Sin cambios" }), { status: 400 });
  }

  binds.push(body.id);
  await db.prepare(`UPDATE promotions SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const DELETE: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  const { db } = auth;

  let body: { id?: string };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  if (!body.id) {
    return new Response(JSON.stringify({ error: "Falta id" }), { status: 400 });
  }

  await db.prepare("DELETE FROM promotions WHERE id = ?").bind(body.id).run();

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};
