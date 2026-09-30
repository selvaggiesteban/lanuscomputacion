import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);

  const user = await getUserFromRequest(request, DB, jwtSecret);
  if (!user || user.is_admin !== 1) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const status = new URL(request.url).searchParams.get("status");

  let sql = "SELECT id, email, name, phone, is_b2b, b2b_status, created_at FROM customers WHERE is_b2b = 1";
  const binds: any[] = [];

  if (status && ["pending", "approved", "rejected"].includes(status)) {
    sql += " AND b2b_status = ?";
    binds.push(status);
  }

  sql += " ORDER BY created_at DESC";

  let results = [];
  try {
    const { results: dbResults } = await DB.prepare(sql).bind(...binds).all();
    results = dbResults;
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/b2b.ts:", e);
  }

  return new Response(JSON.stringify({ customers: (results || []) }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const PUT: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);

  const user = await getUserFromRequest(request, DB, jwtSecret);
  if (!user || user.is_admin !== 1) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  let body: { id?: number; b2b_status?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  if (!body.id || !body.b2b_status || !["approved", "rejected"].includes(body.b2b_status)) {
    return new Response(JSON.stringify({ error: "Datos inválidos" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  try {
    await DB.prepare(
      "UPDATE customers SET b2b_status = ? WHERE id = ? AND is_b2b = 1"
    ).bind(body.b2b_status, body.id).run();
  } catch (e) {
    console.error("D1 Error in frontend/src/pages/api/admin/b2b.ts:", e);
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
