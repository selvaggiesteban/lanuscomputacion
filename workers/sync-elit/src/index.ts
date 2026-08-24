import { ElitClient } from "./client";
import { normalizeElitProduct } from "./normalizer";
import { D1Client } from "./d1";
import { seedCategories } from "./seed_categories";
import { needsMigration, migrateCategories } from "./migrate_categories";
import { resetAiCallCounter, getAiCallCount } from "./ai_classifier";
import { getDollarRate, saveDollarRateHistory, getPreviousDollarRate, dollarRateChange } from "./dollar_rate";
import { recalculatePriceForDollarChange } from "./pricing";

export interface Env {
  lanus_catalog: D1Database;
  AI: Ai;
  ELIT_API_URL: string;
  ELIT_USER_ID: string;
  ELIT_TOKEN: string;
  ELIT_PAGE_LIMIT?: string;
}

const DEFAULT_MARKUP = 30;
const DOLLAR_CHANGE_THRESHOLD = 2; // percent

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
      // Log price change
      await db.prepare(
        `INSERT INTO price_history (product_id, old_price, new_price, old_cost_price, new_cost_price, old_dollar_rate, new_dollar_rate, old_markup_pct, new_markup_pct, reason, changed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'dollar_change', ?)`
      ).bind(
        product.id,
        oldPrice,
        newPrice,
        product.cost_price,
        product.cost_price,
        null,
        newDollarRate,
        product.markup_pct,
        productMarkup,
        new Date().toISOString(),
      ).run();

      // Update product price
      await db.prepare(
        "UPDATE products SET price = ?, dollar_rate = ?, markup_pct = ?, last_price_change = ? WHERE id = ?"
      ).bind(newPrice, newDollarRate, productMarkup, new Date().toISOString(), product.id).run();

      changed++;
    }
  }

  return changed;
}

async function runSync(env: Env) {
  const client = new ElitClient({
    apiUrl: env.ELIT_API_URL,
    userId: env.ELIT_USER_ID,
    token: env.ELIT_TOKEN,
    pageLimit: Number(env.ELIT_PAGE_LIMIT ?? 100),
  });

  const d1 = new D1Client(env.lanus_catalog);

  // Fetch official dollar rate from BCRA
  const dollarRate = await getDollarRate();
  console.log(`[sync-elit] Dollar rate: $${dollarRate.rate} (${dollarRate.source})`);

  // Save dollar rate history and check for significant change
  const rateCheck = await saveDollarRateHistoryAndCheck(env.lanus_catalog, dollarRate.rate, dollarRate.source);

  // Get configurable markup
  const markupPct = await getMarkupConfig(env.lanus_catalog);
  console.log(`[sync-elit] Markup: ${markupPct}%`);

  // If dollar rate changed significantly, recalculate all USD product prices
  if (rateCheck.changed && rateCheck.previousRate) {
    console.log(`[sync-elit] Dollar rate changed ${rateCheck.changePct.toFixed(1)}% (${rateCheck.previousRate} → ${dollarRate.rate}). Recalculating prices...`);
    const priceChanges = await recalculateAllPricesForDollarChange(env.lanus_catalog, dollarRate.rate, markupPct);
    console.log(`[sync-elit] Recalculated ${priceChanges} product prices due to dollar change`);
  }

  // Seed categories (INSERT OR IGNORE, safe every run)
  const { inserted: newCats } = await seedCategories(env.lanus_catalog);
  if (newCats > 0) console.log(`[sync-elit] Seeded ${newCats} new categories`);

  // Run one-time migration if needed (products still have uncategorized)
  if (await needsMigration(env.lanus_catalog)) {
    console.log("[sync-elit] Running one-time category migration...");
    const migration = await migrateCategories(env.lanus_catalog);
    console.log(`[sync-elit] Migration done: ${migration.productsMigrated} migrated, ${migration.productsUnmapped} unmapped`);
    if (migration.unmappedCombos.length > 0) {
      console.log("[sync-elit] Unmapped combos:", migration.unmappedCombos);
    }
  }

  // Reset AI call counter for this sync batch
  resetAiCallCounter();

  console.log("[sync-elit] Fetching products from ELIT...");
  const rawProducts = await client.getAllProducts();
  console.log(`[sync-elit] Fetched ${rawProducts.length} raw products`);

  let inserted = 0;
  let updated = 0;
  let priceChanged = 0;
  const syncedIds: string[] = [];

  for (const raw of rawProducts) {
    try {
      const product = normalizeElitProduct(raw, dollarRate.rate, markupPct);
      if (product.available_qty <= 0) continue;

      syncedIds.push(product.external_id);

      // Check if price changed during upsert
      const existing = await env.lanus_catalog.prepare(
        "SELECT price FROM products WHERE id = ?"
      ).bind(product.id).first<{ price: number }>();

      const result = await d1.upsertProduct(product);
      if (result.inserted) {
        inserted++;
      } else {
        updated++;
        // Log price change if different
        if (existing && existing.price && Math.abs(existing.price - product.price) > 0.01) {
          priceChanged++;
          await env.lanus_catalog.prepare(
            `INSERT INTO price_history (product_id, old_price, new_price, old_dollar_rate, new_dollar_rate, old_markup_pct, new_markup_pct, reason, changed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'sync', ?)`
          ).bind(
            product.id,
            existing.price,
            product.price,
            null,
            dollarRate.rate,
            null,
            markupPct,
            new Date().toISOString(),
          ).run();
        }
      }
    } catch (err) {
      console.error(`[sync-elit] Error normalizing product ${raw.id}:`, err);
    }
  }

  const archived = await d1.deleteOutOfStockProducts(syncedIds);
  const aiCalls = getAiCallCount();
  console.log(`[sync-elit] Done: ${inserted} inserted, ${updated} updated, ${priceChanged} price changes, ${archived} archived${aiCalls > 0 ? `, ${aiCalls} AI calls` : ""}`);
}
