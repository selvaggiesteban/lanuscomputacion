import type { APIRoute } from "astro";
import { requireAdmin, unauthorized } from "../../../lib/admin-auth";
import { MeliClient } from "../../../lib/meli";

// POST /api/meli/hooks — registra/renueva la suscripción al topic orders_v2
// de Mercado Libre apuntando a nuestro webhook (token en query string).
// Docs: https://developers.mercadolibre.com.ar/en_us/products-receive-notifications
// (topic orders_v2 es el recomendado; suscripción programática vía POST /topics).
export const POST: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();

  const env = locals.runtime.env as { ML_CLIENT_ID?: string; ML_CLIENT_SECRET?: string; DIGEST_TOKEN?: string };
  if (!env.DIGEST_TOKEN) {
    return new Response(JSON.stringify({ error: "DIGEST_TOKEN no configurado" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const callback = `https://lanuscomputacion.com/api/webhook/ml-sales?token=${encodeURIComponent(env.DIGEST_TOKEN)}`;
  const topic = "orders_v2";

  try {
    const client = new MeliClient(auth.DB, env.ML_CLIENT_ID ?? "", env.ML_CLIENT_SECRET ?? "");
    const data = await client.request<Record<string, unknown>>(
      `/topics?callback=${encodeURIComponent(callback)}&topic=${topic}`,
      "POST"
    );

    return new Response(JSON.stringify({ registered: true, topic, callback, response: data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("ML hooks registration error:", error?.message || String(error));
    return new Response(JSON.stringify({
      registered: false,
      error: "No se pudo registrar el webhook en Mercado Libre",
      detail: error?.message || String(error),
    }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
};
