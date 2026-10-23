import type { APIRoute } from "astro";
import { requireAdmin, unauthorized } from "../../../lib/admin-auth";
import { checkRateLimit } from "../../../lib/rate-limit";
import { MeliClient } from "../../../lib/meli";
import { MeliSyncService } from "../../../lib/meli-sync-service";
import { getProducts, type Product } from "../../../lib/d1";

// POST /api/meli/sync — sincroniza productos con Mercado Libre.
// Query param opcional: ?productId=<id> para sincronizar solo uno.
export const POST: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();

  const rl = checkRateLimit(`meli-sync:${auth.user.id}`, 10, 60000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Demasiadas solicitudes", resetIn: rl.resetIn }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const env = locals.runtime.env as { ML_CLIENT_ID?: string; ML_CLIENT_SECRET?: string };
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  const client = new MeliClient(auth.DB, env.ML_CLIENT_ID ?? "", env.ML_CLIENT_SECRET ?? "");
  const syncService = new MeliSyncService(client);

  try {
    if (productId) {
      const product = await auth.DB.prepare("SELECT * FROM products WHERE id = ?").bind(productId).first();
      if (!product) {
        return new Response(JSON.stringify({ error: "Producto no encontrado" }), { status: 404, headers: { "Content-Type": "application/json" } });
      }
      const result = await syncService.syncProduct(product as unknown as Product, null, auth.DB);
      return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const products = await getProducts(auth.DB, { includeArchived: false });
    const result = await syncService.syncAllProducts(products, null, auth.DB);
    return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("ML sync error:", error?.message || String(error));
    return new Response(JSON.stringify({ error: error?.message || "Error de sincronización" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
