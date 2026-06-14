export type Product = {
  id: string;
  external_id: string;
  title: string;
  slug: string;
  description: string;
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
  total_items: number;
};

export async function getProducts(db: D1Database, options?: {
  limit?: number;
  offset?: number;
  category?: string;
  search?: string;
  store?: string;
}): Promise<Product[]> {
  let sql = "SELECT * FROM products WHERE status = 'published'";
  const binds: any[] = [];

  if (options?.category && options.category !== 'todas') {
    sql += " AND (category_name = ? OR subcategory_name = ?)";
    binds.push(options.category, options.category);
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
    "SELECT DISTINCT category_name as name FROM products WHERE status = 'published' AND category_name != '' ORDER BY category_name",
  ).all<{ name: string }>();

  return (results ?? []).map((r, i) => ({
    id: String(i),
    name: r.name,
    slug: r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    parent_id: null,
    total_items: 0,
  }));
}

export async function getProductCount(db: D1Database, category?: string): Promise<number> {
  let sql = "SELECT COUNT(*) as count FROM products WHERE status = 'published'";
  const binds: any[] = [];

  if (category && category !== 'todas') {
    sql += " AND (category_name = ? OR subcategory_name = ?)";
    binds.push(category, category);
  }

  const result = await db.prepare(sql).bind(...binds).first<{ count: number }>();
  return result?.count ?? 0;
}
