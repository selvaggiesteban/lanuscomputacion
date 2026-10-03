// migrate_categories.ts
// One-time migration: updates category_id for all existing products in D1
// Uses the static mapping from category_mapping.ts
// Run via: wrangler d1 execute lanus-catalog --file=migrations/001_seed_categories.sql
// Or call migrateCategories() from the sync worker on first run

import { mapElitToCategory } from "./category_mapping";
import { seedCategories } from "./seed_categories";

export interface MigrationResult {
  categoriesSeeded: number;
  productsMigrated: number;
  productsUnmapped: number;
  unmappedCombos: string[];
}

/**
 * Runs the full category migration:
 * 1. Seeds categories table
 * 2. Updates all uncategorized products with the mapped category_id
 *
 * Updates are executed in db.batch() chunks (100 statements each): one
 * statement per product would blow the 1,000 D1 subrequest limit per
 * Worker invocation on the Free plan and abort the sync.
 */
export async function migrateCategories(db: D1Database): Promise<MigrationResult> {
  // 1. Seed categories (single batch call)
  const { inserted: categoriesSeeded } = await seedCategories(db);
  console.log(`[migration] Seeded ${categoriesSeeded} new categories`);

  // 2. Get only the products that still need a category
  const products = await db.prepare(`
    SELECT id, category_name, subcategory_name
    FROM products
    WHERE provider = 'elit' AND (category_id = 'uncategorized' OR category_id IS NULL)
  `).all();

  let productsMigrated = 0;
  let productsUnmapped = 0;
  const unmappedCombos = new Set<string>();
  const statements: D1PreparedStatement[] = [];

  // 3. Map each product
  for (const product of products.results) {
    const catName = String(product.category_name ?? "");
    const subName = String(product.subcategory_name ?? "");

    const mapping = mapElitToCategory(catName, subName);

    if (mapping) {
      statements.push(
        db.prepare(`UPDATE products SET category_id = ? WHERE id = ?`).bind(mapping.category_id, product.id),
      );
    } else {
      unmappedCombos.add(`${catName}|${subName}`);
      productsUnmapped++;
    }
  }

  // 4. Apply updates in batches of 100
  for (let i = 0; i < statements.length; i += 100) {
    const results = await db.batch(statements.slice(i, i + 100));
    for (const result of results) productsMigrated += result.meta.changes ?? 0;
  }

  console.log(`[migration] Migrated: ${productsMigrated}, Unmapped: ${productsUnmapped}`);
  if (unmappedCombos.size > 0) {
    console.log(`[migration] Unmapped combos:`, [...unmappedCombos]);
  }

  return {
    categoriesSeeded,
    productsMigrated,
    productsUnmapped,
    unmappedCombos: [...unmappedCombos],
  };
}

/**
 * Checks if migration is needed (all products have category_id = 'uncategorized')
 */
export async function needsMigration(db: D1Database): Promise<boolean> {
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM products
    WHERE provider = 'elit' AND (category_id = 'uncategorized' OR category_id IS NULL)
  `).first();

  return Number(result?.count ?? 0) > 0;
}
