import type { APIRoute } from "astro";
import { requireAdmin, unauthorized } from "../../../lib/admin-auth";

// GET /api/meli/events — últimos eventos de la integración ML.
export const GET: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();

  try {
    const events = await auth.DB.prepare(
      `SELECT id, event_type, entity, entity_id, status, message, payload, created_at
         FROM meli_events ORDER BY created_at DESC LIMIT 50`
    ).all();

    return new Response(JSON.stringify(events.results || []), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    // Tabla meli_events aún inexistente (migración pendiente)
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
};
