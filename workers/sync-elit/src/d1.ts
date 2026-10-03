import type { NormalizedProduct } from "./normalizer";

export class D1Client {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async getProductByExternalId(externalId: string, provider: string): Promise<any | null> {
    const result = await this.db.prepare(
      "SELECT id FROM products WHERE external_id = ? AND provider = ?",
    ).bind(externalId, provider).first();
    return result ?? null;
  }

  async upsertProduct(product: NormalizedProduct): Promise<{ inserted: boolean }> {
    const existing = await this.getProductByExternalId(product.external_id, "elit");

    if (existing) {
      await this.db.prepare(`
        UPDATE products SET
          title = ?, slug = ?, description = ?, category_id = ?, category_name = ?, subcategory_name = ?,
          brand = ?, price = ?, cost_price = ?, currency = ?, dollar_rate = ?,
          iva_pct = ?, internal_tax_pct = ?, markup_pct = ?, available_qty = ?,
          ean = ?, weight = ?, warranty = ?, permalink = ?, thumbnail = ?,
          status = 'published', last_api_update = datetime('now')
        WHERE id = ?
      `).bind(
        product.title, product.slug, product.description,
        product.category_id, product.category_name, product.subcategory_name,
        product.brand, product.price, product.cost_price, product.currency, product.dollar_rate,
        product.iva_pct, product.internal_tax_pct, product.markup_pct, product.available_qty,
        product.ean, product.weight, product.warranty, product.permalink, product.thumbnail,
        existing.id,
      ).run();
      return { inserted: false };
    }

    await this.db.prepare(`
      INSERT INTO products (
        id, external_id, codigo_alfa, sku, title, slug, description,
        category_id, category_name, subcategory_name, brand, price, cost_price, currency,
        dollar_rate, iva_pct, internal_tax_pct, markup_pct, available_qty,
        ean, weight, warranty, permalink, thumbnail, provider, provider_store,
        status, created_at, last_api_update, published_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', datetime('now'), datetime('now'), datetime('now'))
    `).bind(
      product.id, product.external_id, product.codigo_alfa, product.sku,
      product.title, product.slug, product.description,
      product.category_id, product.category_name, product.subcategory_name,
      product.brand, product.price, product.cost_price, product.currency,
      product.dollar_rate, product.iva_pct, product.internal_tax_pct, product.markup_pct,
      product.available_qty, product.ean, product.weight, product.warranty,
      product.permalink, product.thumbnail, product.provider, product.provider_store,
    ).run();
    return { inserted: true };
  }

  async deleteOutOfStockProducts(syncedIds: string[]): Promise<number> {
    if (syncedIds.length === 0) return 0;

    // D1 allows at most 100 bound parameters per statement, so a single
    // "NOT IN (?,?,...)" with ~1800 ids fails with "too many SQL variables".
    // Fetch the candidates instead and archive the diff in batched UPDATEs.
    const { results } = await this.db.prepare(
      `SELECT external_id FROM products WHERE provider = 'elit' AND status = 'published'`,
    ).all<{ external_id: string }>();

    const synced = new Set(syncedIds);
    const toArchive = results
      .map((row) => row.external_id)
      .filter((externalId): externalId is string => Boolean(externalId) && !synced.has(externalId));

    if (toArchive.length === 0) return 0;

    let archived = 0;
    for (let i = 0; i < toArchive.length; i += 100) {
      const statements = toArchive.slice(i, i + 100).map((externalId) =>
        this.db.prepare(
          `UPDATE products SET status = 'archived' WHERE provider = 'elit' AND external_id = ?`,
        ).bind(externalId),
      );
      const batchResults = await this.db.batch(statements);
      for (const result of batchResults) archived += result.meta.changes ?? 0;
    }
    return archived;
  }
}
