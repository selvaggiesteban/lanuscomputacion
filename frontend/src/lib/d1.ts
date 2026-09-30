export type Product = {
  id: string; external_id: string; title: string; slug: string;
  description: string; category_id: string; category_name: string;
  subcategory_name: string; status: string; price: number;
  cost_price: number; original_price: number | null; currency: string;
  dollar_rate: number; brand: string; ean: string; available_qty: number;
  permalink: string; thumbnail: string; provider: string;
  provider_store: string; free_shipping: number; sku: string;
};

export type Category = {
  id: string; name: string; slug: string; parent_id: string | null;
  level: number; picture: string; total_items: number;
};

// --- CACHE UTILITIES ---
async function getCached<T>(cache: KVNamespace, key: string): Promise<T | null> {
  try {
    const value = await cache.get(key);
    return value ? JSON.parse(value) : null;
  } catch { return null; }
}

async function setCached(cache: KVNamespace, key: string, value: any) {
  try {
    // Cache for 1 hour (3600s) to drastically reduce D1 quota usage
    await cache.put(key, JSON.stringify(value), { expirationTtl: 3600 });
  } catch (e) { console.error("KV Write Error:", e); }
}

// --- OPTIMIZED DATA FETCHING ---
export async function getProducts(env: any, options?: {
  limit?: number; offset?: number; category?: string;
  subcategory?: string; brand?: string; search?: string;
  store?: string; minPrice?: number; maxPrice?: number; sort?: string;
}): Promise<Product[]> {
  const DB = env.DB;
  const cache = env.CACHE;

  // Create a unique cache key based on the query options
  const sortedOptions = options ? Object.keys(options).sort().reduce((acc, key) => {
    acc[key] = options![key];
    return acc;
  }, {} as any) : {};
  const cacheKey = `prod_list:${JSON.stringify(sortedOptions)}`;
  if (cache) {
    const cached = await getCached<Product[]>(cache, cacheKey);
    if (cached) return cached;
  }

  try {
    let sql = "SELECT id, title, slug, price, cost_price, thumbnail, category_id, category_name, subcategory_name, available_qty, dollar_rate, brand, free_shipping, provider_store FROM products WHERE status = 'published'";
    const binds: any[] = [];

    if (options?.category && options.category !== 'todas') { sql += " AND category_id = ?"; binds.push(options.category); }
    if (options?.subcategory && options.subcategory !== 'todas') { sql += " AND subcategory_name = ?"; binds.push(options.subcategory); }
    if (options?.brand) { sql += " AND brand = ?"; binds.push(options.brand); }
    if (options?.search) {
      sql += " AND (title LIKE ? OR brand LIKE ? OR ean LIKE ?)";
      const term = `%${options.search}%`;
      binds.push(term, term, term);
    }
    if (options?.store) { sql += " AND provider_store = ?"; binds.push(options.store); }
    if (options?.minPrice && options.minPrice > 0) { sql += " AND price >= ?"; binds.push(options.minPrice); }
    if (options?.maxPrice && options.maxPrice > 0) { sql += " AND price <= ?"; binds.push(options.maxPrice); }

    switch (options?.sort) {
      case 'price_asc': sql += " ORDER BY price ASC"; break;
      case 'price_desc': sql += " ORDER BY price DESC"; break;
      case 'newest': sql += " ORDER BY created_at DESC"; break;
      default: sql += " ORDER BY available_qty DESC, created_at DESC"; break;
    }

    if (options?.limit) { sql += " LIMIT ?"; binds.push(options.limit); }
    if (options?.offset) { sql += " OFFSET ?"; binds.push(options.offset); }

    try {
      const { results } = await DB.prepare(sql).bind(...binds).all<Product>();
      const data = (results || []);

      if (cache) await setCached(cache, cacheKey, data);
      return data;
    } catch (e: any) {
      console.error("D1 Error in d1.ts:", e);
      return [];
    }
}

export async function getProductBySlug(env: any, slug: string): Promise<Product | null> {
  const DB = env.DB;
  const cache = env.CACHE;
  const cacheKey = `prod_slug:${slug}`;

  if (cache) {
    const cached = await getCached<Product>(cache, cacheKey);
    if (cached) return cached;
  }

  try {
    try {
      const result = await DB.prepare("SELECT * FROM products WHERE slug = ? AND status = 'published'").bind(slug).first<Product>();
      if (result && cache) await setCached(cache, cacheKey, result);
      return result ?? null;
    } catch (e) {
      console.error("D1 Error in d1.ts:", e);
      return null; // Prevent 500 crash
    }
}

export async function getCategories(env: any): Promise<Category[]> {
  const db = env.DB;
  const cache = env.CACHE;
  const cacheKey = "cat_all";

  if (cache) {
    const cached = await getCached<Category[]>(cache, cacheKey);
    if (cached) return cached;
  }

  try {
    try {
      const { results } = await DB.prepare(
        `SELECT c.id, c.name, c.slug, c.parent_id, c.level, c.picture
         FROM categories c
         WHERE c.is_active = 1 AND c.parent_id IS NULL
         ORDER BY c.name`
      ).all<Category>();
      const data = (results || []);
      if (cache) await setCached(cache, cacheKey, data);
      return data;
    } catch (e) {
      console.error("D1 Error in d1.ts:", e);
      return [];
    }
}

export async function getAllCategoriesFlat(env: any): Promise<Category[]> {
  const db = env.DB;
  const cache = env.CACHE;
  const cacheKey = "cat_flat";

  if (cache) {
    const cached = await getCached<Category[]>(cache, cacheKey);
    if (cached) return cached;
  }

  try {
    try {
      const { results } = await DB.prepare(
        `SELECT c.id, c.name, c.slug, c.parent_id, c.level, c.picture
         FROM categories c
         WHERE c.is_active = 1
         ORDER BY c.parent_id, c.name`
      ).all<Category>();
      const data = (results || []);
      if (cache) await setCached(cache, cacheKey, data);
      return data;
    } catch (e) {
      console.error("D1 Error in d1.ts:", e);
      return [];
    }
}
