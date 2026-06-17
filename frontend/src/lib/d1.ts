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
  brand?: string;
  search?: string;
  store?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: string;
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
  if (options?.brand) {
    sql += " AND brand = ?";
    binds.push(options.brand);
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
  if (options?.minPrice && options.minPrice > 0) {
    sql += " AND price >= ?";
    binds.push(options.minPrice);
  }
  if (options?.maxPrice && options.maxPrice > 0) {
    sql += " AND price <= ?";
    binds.push(options.maxPrice);
  }

  switch (options?.sort) {
    case 'price_asc': sql += " ORDER BY price ASC"; break;
    case 'price_desc': sql += " ORDER BY price DESC"; break;
    case 'newest': sql += " ORDER BY created_at DESC"; break;
    default: sql += " ORDER BY available_qty DESC, created_at DESC"; break;
  }

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

export async function getProductCount(db: D1Database, category?: string, subcategory?: string, brand?: string): Promise<number> {
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
  if (brand) {
    sql += " AND brand = ?";
    binds.push(brand);
  }

  const result = await db.prepare(sql).bind(...binds).first<{ count: number }>();
  return result?.count ?? 0;
}

export async function getBrandsByCategory(db: D1Database, categoryId?: string, subcategory?: string): Promise<{ brand: string; count: number }[]> {
  let sql = "SELECT brand, COUNT(*) as count FROM products WHERE status = 'published' AND brand IS NOT NULL AND brand != ''";
  const binds: any[] = [];

  if (categoryId && categoryId !== 'todas') {
    sql += " AND category_id = ?";
    binds.push(categoryId);
  }
  if (subcategory && subcategory !== 'todas') {
    sql += " AND subcategory_name = ?";
    binds.push(subcategory);
  }

  sql += " GROUP BY brand ORDER BY count DESC LIMIT 20";

  const { results } = await db.prepare(sql).bind(...binds).all<{ brand: string; count: number }>();
  return results ?? [];
}

export type Order = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string | null;
  total: number;
  status: string;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  payment_method: string;
  created_at: string;
  updated_at: string;
};

export async function getOrders(db: D1Database, options?: {
  limit?: number;
  offset?: number;
  status?: string;
}): Promise<Order[]> {
  let sql = "SELECT * FROM orders";
  const binds: any[] = [];
  const conditions: string[] = [];

  if (options?.status) {
    conditions.push("status = ?");
    binds.push(options.status);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY created_at DESC";

  if (options?.limit) {
    sql += " LIMIT ?";
    binds.push(options.limit);
  }
  if (options?.offset) {
    sql += " OFFSET ?";
    binds.push(options.offset);
  }

  const { results } = await db.prepare(sql).bind(...binds).all<Order>();
  return results ?? [];
}

export async function getOrderById(db: D1Database, orderId: string): Promise<Order | null> {
  const result = await db.prepare(
    "SELECT * FROM orders WHERE id = ?",
  ).bind(orderId).first<Order>();
  return result ?? null;
}

export type OrderItem = {
  order_id: string;
  product_id: string;
  product_title: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

export async function getOrderItems(db: D1Database, orderId: string): Promise<OrderItem[]> {
  const { results } = await db.prepare(
    "SELECT * FROM order_items WHERE order_id = ?",
  ).bind(orderId).all<OrderItem>();
  return results ?? [];
}
