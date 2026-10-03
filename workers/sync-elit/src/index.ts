import { ElitClient } from "./client";
import { normalizeElitProduct, type NormalizedProduct } from "./normalizer";
import { D1Client } from "./d1";
import { seedCategories } from "./seed_categories";
import { needsMigration, migrateCategories } from "./migrate_categories";
import { resetAiCallCounter, getAiCallCount } from "./ai_classifier";
import { getDollarRate, saveDollarRateHistory, getPreviousDollarRate, dollarRateChange } from "./dollar_rate";
import { recalculatePriceForDollarChange } from "./pricing";
import { notifyOffersChanges } from "./offers-watch";

export interface Env {
  lanus_catalog: D1Database;
  AI: Ai;
  ELIT_API_URL: string;
  ELIT_USER_ID: string;
  ELIT_TOKEN: string;
  ELIT_PAGE_LIMIT?: string;
  RESEND_API_KEY?: string;
}

const DEFAULT_MARKUP = 30;
const DOLLAR_CHANGE_THRESHOLD = 2; // percent

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    console.log("[sync-elit] Starting scheduled sync...");
    await runSync(env);
    console.log("[sync-elit] Sync complete.");
    await runOffersWatch(env);
  },

  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    if (request.method === "GET" && new URL(request.url).pathname === "/__cron") {
      await runSync(env);
      await runOffersWatch(env);
      return new Response("OK", { status: 200 });
    }
    return new Response("Not found", { status: 404 });
  },
};

async function runOffersWatch(env: Env) {
  try {
    await notifyOffersChanges(env);
  } catch (err) {
    console.error("[offers-watch] Notification failed:", err);
  }
}

async function getMarkupConfig(db: D1Database): Promise<number> {
  const row = await db.prepare(
    "SELECT value FROM app_config WHERE key = 'global_markup_pct'"
  ).first<{ value: string }>();
  return row ? Number(row.value) : DEFAULT_MARKUP;
}

async function saveDollarRateHistoryAndCheck(
  db: D1Database,
  newRate: number,
  source: string,
): Promise<{ changed: boolean; previousRate: number | null; changePct: number }> {
  const previousRate = await getPreviousDollarRate(db);
  await saveDollarRateHistory(db, newRate, source);

  if (previousRate === null) {
    return { changed: false, previousRate: null, changePct: 0 };
  }

  const changePct = Math.abs(dollarRateChange(previousRate, newRate));
  return {
    changed: changePct >= DOLLAR_CHANGE_THRESHOLD,
    previousRate,
    changePct,
  };
}

async function recalculateAllPricesForDollarChange(
  db: D1Database,
  newDollarRate: number,
  markupPct: number,
): Promise<number> {
  const { results: usdProducts } = await db.prepare(
    "SELECT id, cost_price, currency, iva_pct, internal_tax_pct, markup_pct, price FROM products WHERE currency = 'USD' AND status = 'published' AND cost_price > 0"
  ).all<{
    id: string;
    cost_price: number;
    currency: string;
    iva_pct: number;
    internal_tax_pct: number;
    markup_pct: number;
    price: number;
  }>();

  let changed = 0;
  const statements: D1PreparedStatement[] = [];

  for (const product of usdProducts) {
    const productMarkup = product.markup_pct || markupPct;
    const newPricing = recalculatePriceForDollarChange(
      product.cost_price,
      product.currency,
      product.iva_pct,
      product.internal_tax_pct,
      productMarkup,
      newDollarRate,
    );

    const oldPrice = product.price;
    const newPrice = newPricing.final_price;

    if (Math.abs(oldPrice - newPrice) > 0.01) {
      statements.push(
        db.prepare(
          `INSERT INTO price_history (product_id, old_price, new_price, old_cost_price, new_cost_price, old_dollar_rate, new_dollar_rate, old_markup_pct, new_markup_pct, reason, changed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'dollar_change', ?)`
        ).bind(
          product.id, oldPrice, newPrice, product.cost_price, product.cost_price,
          null, newDollarRate, product.markup_pct, productMarkup, new Date().toISOString()
        )
      );

      statements.push(
        db.prepare(
          "UPDATE products SET price = ?, dollar_rate = ?, markup_pct = ?, last_price_change = ? WHERE id = ?"
        ).bind(newPrice, newDollarRate, productMarkup, new Date().toISOString(), product.id)
      );

      changed++;
    }
  }

  if (statements.length > 0) {
    // D1 supports up to 100 statements per batch
    for (let i = 0; i < statements.length; i += 100) {
      await db.batch(statements.slice(i, i + 100));
    }
  }

  return changed;
}

interface SyncedProductRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: number;
  cost_price: number;
  dollar_rate: number;
  available_qty: number;
}

// Returns true only when one of the columns the upsert writes would change.
// Skipping unchanged products keeps the hourly sync within the D1 free-tier
// row-write quota (blind upserts used to consume ~92k of the 100k daily limit).
function upsertChangesRow(current: SyncedProductRow, incoming: NormalizedProduct): boolean {
  if (current.title !== incoming.title || current.slug !== incoming.slug) return true;
  if (current.status !== "published") return true;
  if (Math.abs(current.price - incoming.price) > 0.01) return true;
  if (Math.abs(current.cost_price - incoming.cost_price) > 0.01) return true;
  if (Math.abs(current.dollar_rate - incoming.dollar_rate) > 0.01) return true;
  if (current.available_qty !== incoming.available_qty) return true;
  return false;
}

async function runSync(env: Env) {
  const client = new ElitClient({
    apiUrl: env.ELIT_API_URL,
    userId: env.ELIT_USER_ID,
    token: env.ELIT_TOKEN,
    pageLimit: Number(env.ELIT_PAGE_LIMIT ?? 100),
  });

  const d1 = new D1Client(env.lanus_catalog);

  const dollarRate = await getDollarRate();
  console.log(`[sync-elit] Dollar rate: $${dollarRate.rate} (${dollarRate.source})`);

  const rateCheck = await saveDollarRateHistoryAndCheck(env.lanus_catalog, dollarRate.rate, dollarRate.source);
  const markupPct = await getMarkupConfig(env.lanus_catalog);
  console.log(`[sync-elit] Markup: ${markupPct}%`);

  if (rateCheck.changed && rateCheck.previousRate) {
    console.log(`[sync-elit] Dollar rate changed ${rateCheck.changePct.toFixed(1)}% (${rateCheck.previousRate} → ${dollarRate.rate}). Recalculating prices...`);
    const priceChanges = await recalculateAllPricesForDollarChange(env.lanus_catalog, dollarRate.rate, markupPct);
    console.log(`[sync-elit] Recalculated ${priceChanges} product prices due to dollar change`);
  }

  const { inserted: newCats } = await seedCategories(env.lanus_catalog);
  if (newCats > 0) console.log(`[sync-elit] Seeded ${newCats} new categories`);

  if (await needsMigration(env.lanus_catalog)) {
    console.log("[sync-elit] Running one-time category migration...");
    const migration = await migrateCategories(env.lanus_catalog);
    console.log(`[sync-elit] Migration done: ${migration.productsMigrated} migrated, ${migration.productsUnmapped} unmapped`);
  }

  resetAiCallCounter();

  console.log("[sync-elit] Fetching products from ELIT...");
  const rawProducts = await client.getAllProducts();
  console.log(`[sync-elit] Fetched ${rawProducts.length} raw products`);

  // The free tier counts every written row, so only upsert products whose
  // synced columns actually differ from what is already in the database.
  const { results: currentRows } = await env.lanus_catalog.prepare(
    `SELECT id, title, slug, status, price, cost_price, dollar_rate, available_qty
     FROM products WHERE provider = 'elit'`
  ).all<SyncedProductRow>();
  const currentById = new Map(currentRows.map((row): [string, SyncedProductRow] => [row.id, row]));

  let processed = 0;
  let unchanged = 0;
  const syncedIds: string[] = [];
  const statements: D1PreparedStatement[] = [];

  for (const raw of rawProducts) {
    try {
      const product = normalizeElitProduct(raw, dollarRate.rate, markupPct);
      if (product.available_qty <= 0) continue;

      syncedIds.push(product.external_id);

      const current = currentById.get(product.id);
      if (current && !upsertChangesRow(current, product)) {
        unchanged++;
        continue;
      }

      statements.push(
        env.lanus_catalog.prepare(
          `INSERT INTO products (id, external_id, title, slug, description, category_id, category_name, subcategory_name, status, price, cost_price, currency, dollar_rate, brand, ean, available_qty, permalink, thumbnail, provider, provider_store, sku, last_api_update)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, slug=excluded.slug, price=excluded.price, available_qty=excluded.available_qty, cost_price=excluded.cost_price, dollar_rate=excluded.dollar_rate, status=excluded.status, last_api_update=datetime('now')`
        ).bind(
          product.id, product.external_id, product.title, product.slug, product.description,
          product.category_id, product.category_name, product.subcategory_name, "published",
          product.price, product.cost_price, product.currency, product.dollar_rate, product.brand,
          product.ean, product.available_qty, product.permalink, product.thumbnail, product.provider,
          product.provider_store, product.sku
        )
      );

      // Batch execute every 100 statements
      if (statements.length >= 100) {
        await env.lanus_catalog.batch(statements);
        processed += statements.length;
        statements.length = 0; // Clear array
      }
    } catch (err) {
      console.error(`[sync-elit] Error normalizing product ${raw.id}:`, err);
    }
  }

  // Final batch for remaining statements
  if (statements.length > 0) {
    await env.lanus_catalog.batch(statements);
    processed += statements.length;
  }

  const archived = await d1.deleteOutOfStockProducts(syncedIds);
  const aiCalls = getAiCallCount();
  console.log(`[sync-elit] Done: ${processed} products written, ${unchanged} unchanged, ${archived} archived${aiCalls > 0 ? `, ${aiCalls} AI calls` : ""}`);
}
