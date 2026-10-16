import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);

  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  let categories = [];
  try {
    const { results } = await DB.prepare(
      "SELECT * FROM categories ORDER BY level, name"
    ).all();
    categories = results;
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/categories.ts:", e);
  }

  return new Response(JSON.stringify({ categories: (categories || []) }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);

  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  let body: { name?: string; slug?: string; parent_id?: string; picture?: string; level?: number };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  if (!body.name || !body.slug) {
    return new Response(JSON.stringify({ error: "Faltan name y slug" }), { status: 400 });
  }

  const id = `custom_${body.slug.replace(/[^a-z0-9]/g, "_")}`;

  try {
    await DB.prepare(`
      INSERT OR REPLACE INTO categories (id, name, slug, parent_id, level, picture, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))
    `).bind(id, body.name, body.slug, body.parent_id || null, body.level || 0, body.picture || "").run();
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/categories.ts:", e);
  }

  return new Response(JSON.stringify({ success: true, id }), {
    status: 201, headers: { "Content-Type": "application/json" },
  });
};

export const PUT: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);

  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  let body: { id?: string; name?: string; slug?: string; picture?: string; is_active?: number };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  if (!body.id) {
    return new Response(JSON.stringify({ error: "Falta id" }), { status: 400 });
  }

  const updates: string[] = [];
  const binds: any[] = [];

  if (body.name !== undefined) { updates.push("name = ?"); binds.push(body.name); }
  if (body.slug !== undefined) { updates.push("slug = ?"); binds.push(body.slug); }
  if (body.picture !== undefined) { updates.push("picture = ?"); binds.push(body.picture); }
  if (body.is_active !== undefined) { updates.push("is_active = ?"); binds.push(body.is_active); }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: "Sin cambios" }), { status: 400 });
  }

  binds.push(body.id);
  try {
    await DB.prepare(`UPDATE categories SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/categories.ts:", e);
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const DELETE: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);

  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  let body: { id?: string };
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  if (!body.id) {
    return new Response(JSON.stringify({ error: "Falta id" }), { status: 400 });
  }

  try {
    await DB.prepare("UPDATE categories SET is_active = 0 WHERE id = ?").bind(body.id).run();
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/categories.ts:", e);
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};
