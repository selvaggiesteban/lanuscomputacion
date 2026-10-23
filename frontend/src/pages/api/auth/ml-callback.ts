import type { APIRoute } from "astro";

// GET /api/auth/ml-callback — callback del OAuth de Mercado Libre.
// Valida el state contra la cookie meli_oauth_state, intercambia el code por
// un token, guarda los datos del vendedor en meli_tokens y redirige al panel.
const CLEAR_STATE_COOKIE = "meli_oauth_state=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
const REDIRECT_BASE = "/admin/integraciones/ml";
const OAUTH_REDIRECT_URI = "https://lanuscomputacion.com/api/auth/ml-callback";

function redirect(location: string, extraHeaders: Record<string, string> = {}) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Set-Cookie": CLEAR_STATE_COOKIE, ...extraHeaders },
  });
}

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json", "Set-Cookie": CLEAR_STATE_COOKIE },
  });
}

export const GET: APIRoute = async ({ locals, request }) => {
  const env = locals.runtime.env as { DB: D1Database; ML_CLIENT_ID?: string; ML_CLIENT_SECRET?: string };
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code) return jsonError(400, "Falta el código de autorización");

  const cookie = request.headers.get("Cookie") || "";
  const cookieState = cookie.match(/(?:^|;\s*)meli_oauth_state=([^;]+)/)?.[1];
  if (!state || !cookieState || state !== cookieState) {
    return jsonError(400, "State inválido o expirado");
  }

  if (!env.ML_CLIENT_ID || !env.ML_CLIENT_SECRET) {
    return jsonError(500, "Mercado Libre no configurado (ML_CLIENT_ID/ML_CLIENT_SECRET)");
  }

  try {
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.ML_CLIENT_ID,
        client_secret: env.ML_CLIENT_SECRET,
        code,
        redirect_uri: OAUTH_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("ML OAuth token exchange failed:", tokenRes.status, JSON.stringify(tokenData));
      return redirect(`${REDIRECT_BASE}?status=error`);
    }

    const meRes = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const me = await meRes.json();
    if (!meRes.ok) {
      console.error("ML /users/me failed:", meRes.status, JSON.stringify(me));
      return redirect(`${REDIRECT_BASE}?status=error`);
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 0) * 1000).toISOString();
    const scopes = Array.isArray(tokenData.scopes) ? tokenData.scopes.join(" ") : (tokenData.scopes ?? null);

    // Single row for the store owner (columns created by migration 022)
    await env.DB.prepare(
      `INSERT INTO meli_tokens (id, access_token, refresh_token, expires_at, user_id, nickname, scopes, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         user_id = excluded.user_id,
         nickname = excluded.nickname,
         scopes = excluded.scopes,
         updated_at = datetime('now')`
    ).bind(
      tokenData.access_token,
      tokenData.refresh_token,
      expiresAt,
      String(me.id ?? ""),
      me.nickname ?? null,
      scopes
    ).run();

    return redirect(`${REDIRECT_BASE}?status=success`);
  } catch (error: any) {
    console.error("ML OAuth callback error:", error?.message || String(error));
    return redirect(`${REDIRECT_BASE}?status=error`);
  }
};
