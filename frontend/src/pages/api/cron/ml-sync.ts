import type { APIRoute } from "astro";
import { MeliClient } from "../../../lib/meli";
import { MeliSyncService } from "../../../lib/meli-sync-service";
import { getProducts } from "../../../lib/d1";

// POST /api/cron/ml-sync — sincronización total de productos con Mercado Libre
// para el cron externo (cron-job.org). Equivalente al worker workers/ml-sync
// (no desplegado): corre desde este endpoint de Pages protegido con el secret
// DIGEST_TOKEN, igual que /api/digest.
// Auth: Authorization: Bearer <DIGEST_TOKEN>.
// `null` como categoría = resolución interna de categoría por producto
// (contrato con lib/meli-sync-service.ts).

interface CronEnv {
  DB: D1Database;
  DIGEST_TOKEN?: string;
  ML_CLIENT_ID?: string;
  ML_CLIENT_SECRET?: string;
}

export const POST: APIRoute = async ({ locals, request }) => {
  const env = (locals.runtime as any).env as CronEnv;

  if (!env.DIGEST_TOKEN) {
    return new Response(JSON.stringify({ ok: false, error: "DIGEST_TOKEN no configurado (Pages secret)" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const auth = request.headers.get("Authorization") || "";
  if (auth !== `Bearer ${env.DIGEST_TOKEN}`) {
    return new Response(JSON.stringify({ ok: false, error: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const client = new MeliClient(env.DB, env.ML_CLIENT_ID ?? "", env.ML_CLIENT_SECRET ?? "");
    const svc = new MeliSyncService(client);
    const products = await getProducts(env.DB, { includeArchived: false });
    const result = await svc.syncAllProducts(products, null, env.DB);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
