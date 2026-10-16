import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);

  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    let product = null;
    try {
      product = await DB.prepare("SELECT * FROM products WHERE id = ?").bind(id).first();
    } catch (e) {
      console.error("D1 Error in frontend/src/pages/api/admin/products.ts:", e);
    }
    return new Response(JSON.stringify({ product }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  let products = [];
  try {
    const { results } = await DB.prepare("SELECT * FROM products ORDER BY created_at DESC LIMIT 100").all();
    products = results;
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/products.ts:", e);
  }
  return new Response(JSON.stringify({ products: (products || []) }), { status: 200, headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);

  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  let body: any;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const slug = (body.title || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  let result = null;
  try {
    result = await DB.prepare(`
      INSERT INTO products (title, slug, description, category_id, category_name, subcategory_name, brand, price, cost_price, currency, available_qty, thumbnail, status, provider, provider_store, created_at, last_api_update)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', 'manual', 'minorista', datetime('now'), datetime('now'))
    `).bind(
      body.title, slug, body.description || "", body.category_id || "uncategorized",
      body.category_name || "", body.subcategory_name || "", body.brand || "",
      body.price || 0, body.cost_price || 0, "ARS", body.available_qty || 0,
      body.thumbnail || ""
    ).run();
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/products.ts:", e);
  }

  return new Response(JSON.stringify({ success: true, id: result?.meta?.last_row_id }), {
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

  let body: any;
  try { body = await request.json(); } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  if (!body.id) {
    return new Response(JSON.stringify({ error: "Falta id" }), { status: 400 });
  }

  const updates: string[] = [];
  const binds: any[] = [];

  for (const field of ["title", "description", "category_id", "category_name", "subcategory_name", "brand", "price", "cost_price", "available_qty", "thumbnail", "status"]) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`);
      binds.push(body[field]);
    }
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: "Sin cambios" }), { status: 400 });
  }

  updates.push("last_api_update = datetime('now')");
  binds.push(body.id);

  try {
    await DB.prepare(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`).bind(...binds).run();
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/products.ts:", e);
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
    await DB.prepare("UPDATE products SET status = 'archived' WHERE id = ?").bind(body.id).run();
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/products.ts:", e);
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } });
};
