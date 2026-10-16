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
  free_shipping: number;
  sku: string;
  iva_pct: number;
  internal_tax_pct: number;
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
  if (!db) return [];
  let sql = "SELECT id, title, slug, price, cost_price, thumbnail, category_id, category_name, subcategory_name, available_qty, dollar_rate, brand, free_shipping, provider_store, iva_pct, internal_tax_pct FROM products WHERE status = 'published'";
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
  if (!db) return null;
  const result = await db.prepare(
    "SELECT * FROM products WHERE slug = ? AND status = 'published'",
  ).bind(slug).first<Product>();
  return result ?? null;
}

export async function getCategories(db: D1Database): Promise<Category[]> {
  if (!db) {
    return [
      { id: "cat_celulares", name: "Celulares", slug: "celulares", parent_id: null, level: 0, picture: "", total_items: 0 },
      { id: "cat_computacion", name: "Computación", slug: "computacion", parent_id: null, level: 0, picture: "", total_items: 0 },
    ];
  }
  const { results } = await db.prepare(
    `SELECT c.id, c.name, c.slug, c.parent_id, c.level, c.picture
     FROM categories c
     WHERE c.is_active = 1 AND c.parent_id IS NULL
     ORDER BY c.name`,
  ).all<Category>();

  return results ?? [];
}

export async function getBestSellers(db: D1Database): Promise<Product[]> {
  if (!db) {
    return [
      {
        id: "1",
        external_id: "1",
        title: "Producto de Ejemplo",
        slug: "producto-ejemplo",
        description: "Ejemplo",
        category_id: "cat_celulares",
        category_name: "Celulares",
        subcategory_name: "Smarphones",
        status: "published",
        price: 1000,
        cost_price: 800,
        original_price: null,
        currency: "ARS",
        dollar_rate: 1,
        brand: "Marca",
        ean: "123",
        available_qty: 10,
        permalink: "",
        thumbnail: "/placeholder.webp",
        provider: "directo",
        provider_store: "tienda",
        free_shipping: 0,
        sku: "SKU123",
        iva_pct: 21,
        internal_tax_pct: 0,
      },
    ];
  }
  try {
    const { results } = await db.prepare("SELECT * FROM products WHERE status = 'published' ORDER BY available_qty DESC LIMIT 20").all<Product>();
    return results ?? [];
  } catch (e) {
    console.error("Error fetching best sellers:", e);
    return [];
  }
}

export async function getAllCategoriesFlat(db: D1Database): Promise<Category[]> {
  if (!db) return [];
  const { results } = await db.prepare(
    `SELECT c.id, c.name, c.slug, c.parent_id, c.level, c.picture
     FROM categories c
     WHERE c.is_active = 1
     ORDER BY c.parent_id, c.name`,
  ).all<Category>();
  return results ?? [];
}

export async function getAllCategoriesTree(db: D1Database): Promise<any[]> {
  const flat = await getAllCategoriesFlat(db);
  const parents = flat.filter(c => c.parent_id === null);
  const childrenMap = new Map<string, Category[]>();

  for (const cat of flat) {
    if (cat.parent_id) {
      const list = childrenMap.get(cat.parent_id) ?? [];
      list.push(cat);
      childrenMap.set(cat.parent_id, list);
    }
  }

  return parents.map(p => ({
    ...p,
    subcategories: childrenMap.get(p.id) ?? [],
  }));
}

export async function getSubcategories(db: D1Database, parentId: string): Promise<Category[]> {
  if (!db) return [];
  const { results } = await db.prepare(
    `SELECT c.id, c.name, c.slug, c.parent_id, c.level, c.picture
     FROM categories c
     WHERE c.is_active = 1 AND c.parent_id = ?
     ORDER BY c.name`,
  ).bind(parentId).all<Category>();

  return results ?? [];
}

export async function getCategoryBySlug(db: D1Database, slug: string): Promise<Category | null> {
  if (!db) return null;
  const result = await db.prepare(
    `SELECT c.id, c.name, c.slug, c.parent_id, c.level, c.picture
     FROM categories c
     WHERE c.slug = ? AND c.is_active = 1`,
  ).bind(slug).first<Category>();
  return result ?? null;
}

export async function getProductCount(db: D1Database, category?: string, subcategory?: string, brand?: string): Promise<number> {
  if (!db) return 0;
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
  if (!db) return [];
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
