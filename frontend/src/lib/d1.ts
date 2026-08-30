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

export async function getAllCategoriesWithChildren(db: D1Database): Promise<(Category & { children: Category[] })[]> {
  const parents = await getCategories(db);
  const withChildren: (Category & { children: Category[] })[] = [];

  for (const parent of parents) {
    const children = await getSubcategories(db, parent.id);
    withChildren.push({ ...parent, children });
  }

  return withChildren;
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

export type Promotion = {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  applies_to: 'all' | 'category' | 'product';
  target_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
};

export async function getActivePromotions(db: D1Database): Promise<Promotion[]> {
  const { results } = await db.prepare(`
    SELECT * FROM promotions
    WHERE is_active = 1
    AND (start_date IS NULL OR start_date <= datetime('now'))
    AND (end_date IS NULL OR end_date >= datetime('now'))
  `).all<Promotion>();
  return results ?? [];
}

export function computePromoDiscount(
  promotions: Promotion[],
  productId: string,
  categoryId: string,
  price: number,
): { discount: number; promoPrice: number; promoName: string } | null {
  // Find matching promotions (most specific first: product > category > all)
  let bestMatch: Promotion | null = null;

  for (const promo of promotions) {
    if (promo.applies_to === 'product' && promo.target_id === productId) {
      bestMatch = promo;
      break;
    }
    if (promo.applies_to === 'category' && promo.target_id === categoryId) {
      if (!bestMatch || bestMatch.applies_to !== 'product') bestMatch = promo;
    }
    if (promo.applies_to === 'all') {
      if (!bestMatch) bestMatch = promo;
    }
  }

  if (!bestMatch) return null;

  let promoPrice: number;
  if (bestMatch.type === 'percentage') {
    promoPrice = Math.round(price * (1 - bestMatch.value / 100) * 100) / 100;
  } else {
    promoPrice = Math.max(0, price - bestMatch.value);
  }

  const discount = Math.round(((price - promoPrice) / price) * 100);

  return { discount, promoPrice, promoName: bestMatch.name };
}

// ─── Coupons ────────────────────────────────────────────────────────────────

export type Coupon = {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  min_purchase: number;
  max_uses: number | null;
  used_count: number;
  applies_to: 'all' | 'category' | 'product';
  target_id: string | null;
  start_date: string | null;
  end_date: string | null;
  is_active: number;
};

export async function validateCoupon(
  db: D1Database,
  code: string,
  cartTotal: number,
): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> {
  const coupon = await db.prepare(
    "SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) AND is_active = 1"
  ).bind(code).first<Coupon>();

  if (!coupon) return { valid: false, error: 'Cupón no encontrado o inactivo' };

  if (coupon.start_date && new Date(coupon.start_date) > new Date()) {
    return { valid: false, error: 'El cupón aún no está vigente' };
  }
  if (coupon.end_date && new Date(coupon.end_date) < new Date()) {
    return { valid: false, error: 'El cupón expiró' };
  }
  if (coupon.max_uses && coupon.used_count >= coupon.max_uses) {
    return { valid: false, error: 'El cupón alcanzó el máximo de usos' };
  }
  if (cartTotal < coupon.min_purchase) {
    return { valid: false, error: `Compra mínima: $${coupon.min_purchase.toLocaleString('es-AR')}` };
  }

  return { valid: true, coupon };
}

export function applyCouponDiscount(
  coupon: Coupon,
  productId: string,
  categoryId: string,
  price: number,
): { discounted: boolean; finalPrice: number } {
  if (coupon.applies_to === 'product' && coupon.target_id !== productId) {
    return { discounted: false, finalPrice: price };
  }
  if (coupon.applies_to === 'category' && coupon.target_id !== categoryId) {
    return { discounted: false, finalPrice: price };
  }

  let finalPrice: number;
  if (coupon.type === 'percentage') {
    finalPrice = Math.round(price * (1 - coupon.value / 100) * 100) / 100;
  } else {
    finalPrice = Math.max(0, price - coupon.value);
  }

  return { discounted: true, finalPrice };
}

export async function incrementCouponUsage(db: D1Database, couponId: string): Promise<void> {
  await db.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id = ?").bind(couponId).run();
}

export async function getAllCoupons(db: D1Database): Promise<Coupon[]> {
  const { results } = await db.prepare("SELECT * FROM coupons ORDER BY created_at DESC").all<Coupon>();
  return results ?? [];
}

export async function getCouponById(db: D1Database, id: string): Promise<Coupon | null> {
  return await db.prepare("SELECT * FROM coupons WHERE id = ?").bind(id).first<Coupon>() ?? null;
}

export async function upsertCoupon(db: D1Database, coupon: {
  id: string; code: string; type: string; value: number;
  min_purchase?: number; max_uses?: number | null;
  applies_to?: string; target_id?: string | null;
  start_date?: string | null; end_date?: string | null;
  is_active?: number;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO coupons (id, code, type, value, min_purchase, max_uses, applies_to, target_id, start_date, end_date, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      code=excluded.code, type=excluded.type, value=excluded.value,
      min_purchase=excluded.min_purchase, max_uses=excluded.max_uses,
      applies_to=excluded.applies_to, target_id=excluded.target_id,
      start_date=excluded.start_date, end_date=excluded.end_date, is_active=excluded.is_active
  `).bind(
    coupon.id, coupon.code, coupon.type, coupon.value,
    coupon.min_purchase ?? 0, coupon.max_uses ?? null,
    coupon.applies_to ?? 'all', coupon.target_id ?? null,
    coupon.start_date ?? null, coupon.end_date ?? null,
    coupon.is_active ?? 1,
  ).run();
}

export async function deleteCoupon(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM coupons WHERE id = ?").bind(id).run();
}

// ─── B2B Rules ──────────────────────────────────────────────────────────────

export type B2bRule = {
  id: string;
  category_name: string;
  discount_pct: number;
  min_quantity: number;
  is_active: number;
};

export async function getB2bRules(db: D1Database): Promise<B2bRule[]> {
  const { results } = await db.prepare("SELECT * FROM b2b_rules ORDER BY category_name").all<B2bRule>();
  return results ?? [];
}

export async function getActiveB2bRules(db: D1Database): Promise<B2bRule[]> {
  const { results } = await db.prepare("SELECT * FROM b2b_rules WHERE is_active = 1 ORDER BY category_name").all<B2bRule>();
  return results ?? [];
}

export async function getB2bRuleForCategory(db: D1Database, categoryName: string): Promise<B2bRule> {
  const rules = await getActiveB2bRules(db);
  const match = rules.find(r => r.category_name.toLowerCase() === categoryName?.toLowerCase());
  return match ?? rules.find(r => r.category_name === 'Default') ?? { id: 'b2b_default', category_name: 'Default', discount_pct: 0.10, min_quantity: 6, is_active: 1 };
}

export async function upsertB2bRule(db: D1Database, rule: {
  id: string; category_name: string; discount_pct: number;
  min_quantity: number; is_active?: number;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO b2b_rules (id, category_name, discount_pct, min_quantity, is_active)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_name=excluded.category_name, discount_pct=excluded.discount_pct,
      min_quantity=excluded.min_quantity, is_active=excluded.is_active
  `).bind(rule.id, rule.category_name, rule.discount_pct, rule.min_quantity, rule.is_active ?? 1).run();
}

export async function deleteB2bRule(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM b2b_rules WHERE id = ?").bind(id).run();
}

// ─── Store Config ───────────────────────────────────────────────────────────

export type StoreConfig = {
  installment_count: number;
  installment_has_interest: boolean;
  bank_transfer_discount_pct: number;
};

export async function getStoreConfig(db: D1Database): Promise<StoreConfig> {
  const { results } = await db.prepare("SELECT key, value FROM store_config").all<{ key: string; value: string }>();
  const map = Object.fromEntries(results.map(r => [r.key, r.value]));
  return {
    installment_count: Number(map.installment_count) || 12,
    installment_has_interest: map.installment_has_interest === 'true',
    bank_transfer_discount_pct: Number(map.bank_transfer_discount_pct) || 10,
  };
}

export async function setStoreConfig(db: D1Database, key: string, value: string): Promise<void> {
  await db.prepare(`
    INSERT INTO store_config (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).bind(key, value).run();
}
