import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  try {
    const DB = locals.runtime.env.DB as D1Database;
    const jwtSecret = getJwtSecret(locals.runtime.env);
    const user = await getUserFromRequest(request, DB, jwtSecret);

    if (!user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    let notifications = [];
    try {
      const { results } = await DB.prepare(
        "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
      ).bind(user.id).all();
      notifications = results;
    } catch (e) {
      console.error("Error fetching notifications:", e);
    }

    return new Response(JSON.stringify({ notifications: notifications || [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Notifications API error:", err);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
