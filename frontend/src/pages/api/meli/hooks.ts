import type { APIRoute } from "astro";
import { requireAdmin, unauthorized } from "../../../lib/admin-auth";

// POST /api/meli/hooks — devuelve la URL de callback para configurar el
// webhook en Mercado Libre.
//
// El alta por API NO está disponible para esta app:
// - POST /topics → 404 (endpoint deprecado, ya no existe).
// - POST /applications/{app_id}/webhooks → 403 nginx (solo para apps
//   certificadas / partners).
// La doc oficial de ML (products-receive-notifications) prescribe suscribirse
// desde "Mis Aplicaciones" → Callback URL + checklist de Topics, por lo que la
// UI copia esta URL y la pega el administrador en el panel de ML.
export const POST: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();

  const env = locals.runtime.env as { DIGEST_TOKEN?: string };
  if (!env.DIGEST_TOKEN) {
    return new Response(JSON.stringify({ error: "DIGEST_TOKEN no configurado" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const callback = `https://lanuscomputacion.com/api/webhook/ml-sales?token=${encodeURIComponent(env.DIGEST_TOKEN)}`;
  const topic = "orders_v2";

  return new Response(
    JSON.stringify({
      callback,
      topic,
      appUrl: "https://apps.mercadolibre.com.ar/",
      steps: [
        'Abrí Mis Aplicaciones y editá la app "Lanús Computacion".',
        'Pegá la URL en "Callback URL Notifications".',
        `Activá el topic ${topic} en la lista de Topics y guardá.`,
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
