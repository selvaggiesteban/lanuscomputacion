import type { PagesRequest, PagesResponse } from "@cloudflare/workers-types";
import { getDB } from "../../lib/d1"; // Assuming getDB exists or is available in env

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Missing authorization code", { status: 400 });
  }

  try {
    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: env.ML_CLIENT_ID,
        client_secret: env.ML_CLIENT_SECRET,
        code: code,
        redirect_uri: "https://lanuscomputacion.com/api/auth/ml-callback",
      }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(JSON.stringify(data));

    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    // Save to D1 (single row for the store owner)
    await env.DB.prepare(
      "INSERT INTO meli_tokens (id, access_token, refresh_token, expires_at) VALUES (1, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET access_token=excluded.access_token, refresh_token=excluded.refresh_token, expires_at=excluded.expires_at"
    ).bind(data.access_token, data.refresh_token, expiresAt).run();

    return Response.redirect("https://lanuscomputacion.com/admin/integraciones/ml?status=success", 302);
  } catch (error: any) {
    return new Response(`Authentication failed: ${error.message}`, { status: 500 });
  }
};
