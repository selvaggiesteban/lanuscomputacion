export type Product = {
  id: string;
  external_id: string;
  title: string;
  slug: string;
  description: string;
  category_id: string;
  category_name: string;
  subcategory_name: string;
  status: string;
  price: number;
  cost_price: number;
  original_price: number | null;
  currency: string;
  dollar_rate: number;
  brand: string;
  ean: string;
  available_qty: number;
  permalink: string;
  thumbnail: string;
  provider: string;
  provider_store: string;
};

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  level: number;
  picture: string;
  total_items: number;
};

export async function getProducts(db: D1Database, options?: {
  limit?: number;
  offset?: number;
  category?: string;
  subcategory?: string;
  search?: string;
  store?: string;
}): Promise<Product[]> {
  let sql = "SELECT * FROM products WHERE status = 'published'";
  const binds: any[] = [];

  if (options?.category && options.category !== 'todas') {
    sql += " AND category_id = ?";
    binds.push(options.category);
  }
  if (options?.subcategory && options.subcategory !== 'todas') {
    sql += " AND subcategory_name = ?";
    binds.push(options.subcategory);
  }
  if (options?.search) {
    sql += " AND (title LIKE ? OR brand LIKE ? OR ean LIKE ?)";
    const term = `%${options.search}%`;
    binds.push(term, term, term);
  }
  if (options?.store) {
    sql += " AND provider_store = ?";
    binds.push(options.store);
  }

  sql += " ORDER BY available_qty DESC, created_at DESC";

  if (options?.limit) {
    sql += " LIMIT ?";
    binds.push(options.limit);
  }
  if (options?.offset) {
    sql += " OFFSET ?";
    binds.push(options.offset);
  }

  const { results } = await db.prepare(sql).bind(...binds).all<Product>();
  return results ?? [];
}

export async function getProductBySlug(db: D1Database, slug: string): Promise<Product | null> {
  const result = await db.prepare(
    "SELECT * FROM products WHERE slug = ? AND status = 'published'",
  ).bind(slug).first<Product>();
  return result ?? null;
}

export async function getCategories(db: D1Database): Promise<Category[]> {
  const { results } = await db.prepare(
    `SELECT c.id, c.name, c.slug, c.parent_id, c.level, c.picture,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'published') as total_items
     FROM categories c
     WHERE c.is_active = 1 AND c.parent_id IS NULL
     ORDER BY c.name`,
  ).all<Category>();

  return results ?? [];
}

export async function getSubcategories(db: D1Database, parentId: string): Promise<Category[]> {
  const { results } = await db.prepare(
    `SELECT c.id, c.name, c.slug, c.parent_id, c.level, c.picture,
            (SELECT COUNT(*) FROM products p WHERE p.subcategory_name = c.name AND p.status = 'published') as total_items
     FROM categories c
     WHERE c.is_active = 1 AND c.parent_id = ?
     ORDER BY c.name`,
  ).bind(parentId).all<Category>();

  return results ?? [];
}

export async function getCategoryBySlug(db: D1Database, slug: string): Promise<Category | null> {
  const result = await db.prepare(
    `SELECT c.id, c.name, c.slug, c.parent_id, c.level, c.picture,
            (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.status = 'published') as total_items
     FROM categories c
     WHERE c.slug = ? AND c.is_active = 1`,
  ).bind(slug).first<Category>();
  return result ?? null;
}

export async function getProductCount(db: D1Database, category?: string, subcategory?: string): Promise<number> {
  let sql = "SELECT COUNT(*) as count FROM products WHERE status = 'published'";
  const binds: any[] = [];

  if (category && category !== 'todas') {
    sql += " AND category_id = ?";
    binds.push(category);
  }
  if (subcategory && subcategory !== 'todas') {
    sql += " AND subcategory_name = ?";
    binds.push(subcategory);
  }

  const result = await db.prepare(sql).bind(...binds).first<{ count: number }>();
  return result?.count ?? 0;
}
