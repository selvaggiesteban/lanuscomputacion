import type { APIRoute } from "astro";
import { requireAdmin, unauthorized } from "../../../lib/admin-auth";
import { checkRateLimit } from "../../../lib/rate-limit";

// GET /api/meli/connect — inicia el OAuth de Mercado Libre. Genera un state
// aleatorio (cookie HttpOnly, 10 min) y redirige a la pantalla de autorización.
export const GET: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();

  const env = locals.runtime.env as { ML_CLIENT_ID?: string };
  const clientId = env.ML_CLIENT_ID;
  if (!clientId) {
    return new Response(JSON.stringify({ error: "ML_CLIENT_ID no configurado" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rl = checkRateLimit(`meli-connect:${auth.user.id}:${ip}`, 10, 60000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Demasiadas solicitudes", resetIn: rl.resetIn }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const state = crypto.randomUUID();
  const redirectUri = "https://lanuscomputacion.com/api/auth/ml-callback";
  const authUrl = new URL("https://auth.mercadolibre.com.ar/authorization");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("redirect_uri", redirectUri);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      "Set-Cookie": `meli_oauth_state=${state}; HttpOnly; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
};
