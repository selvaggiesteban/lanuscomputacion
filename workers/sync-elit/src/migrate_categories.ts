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
 * 2. Updates all products with correct category_id
 */
export async function migrateCategories(db: D1Database): Promise<MigrationResult> {
  // 1. Seed categories
  const { inserted: categoriesSeeded } = await seedCategories(db);
  console.log(`[migration] Seeded ${categoriesSeeded} new categories`);

  // 2. Get all products with their current category/subcategory text
  const products = await db.prepare(`
    SELECT id, category_name, subcategory_name, category_id
    FROM products
    WHERE provider = 'elit'
  `).all();

  let productsMigrated = 0;
  let productsUnmapped = 0;
  const unmappedCombos = new Set<string>();

  // 3. Map each product
  for (const product of products.results) {
    const catName = String(product.category_name ?? "");
    const subName = String(product.subcategory_name ?? "");

    const mapping = mapElitToCategory(catName, subName);

    if (mapping) {
      await db.prepare(`
        UPDATE products SET category_id = ? WHERE id = ?
      `).bind(mapping.category_id, product.id).run();
      productsMigrated++;
    } else {
      unmappedCombos.add(`${catName}|${subName}`);
      productsUnmapped++;
    }
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
