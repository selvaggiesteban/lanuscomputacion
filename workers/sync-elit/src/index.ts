import { ElitClient } from "./client";
import { normalizeElitProduct } from "./normalizer";
import { D1Client } from "./d1";

export interface Env {
  lanus_catalog: D1Database;
  ELIT_API_URL: string;
  ELIT_USER_ID: string;
  ELIT_TOKEN: string;
  ELIT_PAGE_LIMIT?: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    console.log("[sync-elit] Starting scheduled sync...");
    await runSync(env);
    console.log("[sync-elit] Sync complete.");
  },

  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    if (request.method === "GET" && new URL(request.url).pathname === "/__cron") {
      await runSync(env);
      return new Response("OK", { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  },
};

async function runSync(env: Env) {
  const client = new ElitClient({
    apiUrl: env.ELIT_API_URL,
    userId: env.ELIT_USER_ID,
    token: env.ELIT_TOKEN,
    pageLimit: Number(env.ELIT_PAGE_LIMIT ?? 100),
  });

  const d1 = new D1Client(env.lanus_catalog);

  console.log("[sync-elit] Fetching products from ELIT...");
  const rawProducts = await client.getAllProducts();
  console.log(`[sync-elit] Fetched ${rawProducts.length} raw products`);

  let inserted = 0;
  let updated = 0;
  const syncedIds: string[] = [];

  for (const raw of rawProducts) {
    try {
      const product = normalizeElitProduct(raw);
      if (product.available_qty <= 0) continue;

      syncedIds.push(product.external_id);

      const result = await d1.upsertProduct(product);
      if (result.inserted) inserted++;
      else updated++;
    } catch (err) {
      console.error(`[sync-elit] Error normalizing product ${raw.id}:`, err);
    }
  }

  const archived = await d1.deleteOutOfStockProducts(syncedIds);
  console.log(`[sync-elit] Done: ${inserted} inserted, ${updated} updated, ${archived} archived`);
}
