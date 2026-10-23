import type { APIRoute } from "astro";
import { requireAdmin, unauthorized } from "../../../lib/admin-auth";

interface MeliTokenRow {
  access_token: string | null;
  nickname: string | null;
  user_id: string | null;
  scopes: string | null;
  expires_at: string | null;
  last_sync_at: string | null;
}

// GET /api/meli/status — estado de la conexión con Mercado Libre.
export const GET: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();

  try {
    const row = await auth.DB.prepare(
      "SELECT access_token, nickname, user_id, scopes, expires_at, last_sync_at FROM meli_tokens WHERE id = 1"
    ).first<MeliTokenRow>();

    return new Response(JSON.stringify({
      connected: Boolean(row?.access_token),
      nickname: row?.nickname ?? null,
      userId: row?.user_id ?? null,
      scopes: row?.scopes ?? null,
      tokenExpiresAt: row?.expires_at ?? null,
      lastSyncAt: row?.last_sync_at ?? null,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    // Tabla meli_tokens aún inexistente (migración pendiente)
    return new Response(JSON.stringify({
      connected: false,
      nickname: null,
      userId: null,
      scopes: null,
      tokenExpiresAt: null,
      lastSyncAt: null,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
};
