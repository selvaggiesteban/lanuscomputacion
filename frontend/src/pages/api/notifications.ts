import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, db, jwtSecret);

  if (!user) {
    return new Response(JSON.stringify({ error: "No autenticado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { results: notifications } = await db.prepare(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
  ).bind(user.id).all();

  return new Response(JSON.stringify({ notifications }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
