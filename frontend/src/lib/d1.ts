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

export type Order = {
  id: string;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
  [key: string]: any;
};

export type Promotion = {
  id: string;
  code: string;
  discount_pct: number;
  active: boolean;
  [key: string]: any;
};

export type NfcCard = {
  id: string;
  slug: string;
  title: string;
  scans: number;
  [key: string]: any;
};

export type MessagingChannel = {
  id: string;
  name: string;
  type: string;
  config: any;
};

export type Contact = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export type MessageTemplate = {
  id: string;
  name: string;
  content: string;
};

export type B2bRule = {
  id: string;
  customer_id: string;
  discount_pct: number;
  active: boolean;
};

export type Coupon = {
  id: string;
  code: string;
  discount_value: number;
  usage_count: number;
  max_usage: number;
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

export async function getAllCategoriesWithChildren(db: D1Database): Promise<any[]> {
  return await getAllCategoriesTree(db);
}

export async function getOrderById(db: D1Database, id: string): Promise<Order | null> {
  if (!db) return null;
  const result = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(id).first<Order>();
  return result ?? null;
}

export async function getOrders(db: D1Database, options?: { limit?: number; offset?: number }): Promise<Order[]> {
  if (!db) return [];
  let sql = "SELECT * FROM orders ORDER BY created_at DESC";
  const binds: any[] = [];
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

export async function getActivePromotions(db: D1Database): Promise<Promotion[]> {
  if (!db) return [];
  const { results } = await db.prepare("SELECT * FROM promotions WHERE active = 1").all<Promotion>();
  return results ?? [];
}

export async function computePromoDiscount(db: D1Database, productId: string, userId?: string): Promise<number> {
  if (!db) return 0;
  const promo = await db.prepare("SELECT discount_pct FROM promotions WHERE active = 1 AND product_id = ? LIMIT 1").bind(productId).first<Promotion>();
  return promo?.discount_pct ?? 0;
}

export async function getActiveB2bRules(db: D1Database, userId?: string): Promise<B2bRule[]> {
  if (!db) return [];
  const { results } = await db.prepare("SELECT * FROM b2b_rules WHERE active = 1 AND (customer_id = ? OR customer_id = 'all')").bind(userId || 'all').all<B2bRule>();
  return results ?? [];
}

export async function getStoreConfig(db: D1Database): Promise<any> {
  if (!db) return { name: "Lanus Computacion", currency: "ARS" };
  const result = await db.prepare("SELECT * FROM store_config LIMIT 1").first<any>();
  return result ?? { name: "Lanus Computacion", currency: "ARS" };
}

export async function incrementCouponUsage(db: D1Database, couponId: string): Promise<void> {
  if (!db) return;
  await db.prepare("UPDATE coupons SET usage_count = usage_count + 1 WHERE id = ?").bind(couponId).run();
}

export async function validateCoupon(db: D1Database, code: string): Promise<boolean> {
  if (!db) return false;
  const result = await db.prepare("SELECT id FROM coupons WHERE code = ? AND usage_count < max_usage").bind(code).first<any>();
  return !!result;
}

export async function applyCouponDiscount(db: D1Database, code: string): Promise<number> {
  if (!db) return 0;
  const result = await db.prepare("SELECT discount_value FROM coupons WHERE code = ?").bind(code).first<any>();
  return result?.discount_value ?? 0;
}

export async function getB2bRules(db: D1Database): Promise<B2bRule[]> {
  if (!db) return [];
  const { results } = await db.prepare("SELECT * FROM b2b_rules").all<B2bRule>();
  return results ?? [];
}

export async function upsertB2bRule(db: D1Database, rule: B2bRule): Promise<void> {
  if (!db) return;
  await db.prepare("INSERT INTO b2b_rules (id, customer_id, discount_pct, active) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET customer_id=excluded.customer_id, discount_pct=excluded.discount_pct, active=excluded.active").bind(rule.id, rule.customer_id, rule.discount_pct, rule.active ? 1 : 0).run();
}

export async function deleteB2bRule(db: D1Database, id: string): Promise<void> {
  if (!db) return;
  await db.prepare("DELETE FROM b2b_rules WHERE id = ?").bind(id).run();
}

export async function getAllCoupons(db: D1Database): Promise<Coupon[]> {
  if (!db) return [];
  const { results } = await db.prepare("SELECT * FROM coupons").all<Coupon>();
  return results ?? [];
}

export async function upsertCoupon(db: D1Database, coupon: Coupon): Promise<void> {
  if (!db) return;
  await db.prepare("INSERT INTO coupons (id, code, discount_value, usage_count, max_usage) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET code=excluded.code, discount_value=excluded.discount_value, usage_count=excluded.usage_count, max_usage=excluded.max_usage").bind(coupon.id, coupon.code, coupon.discount_value, coupon.usage_count, coupon.max_usage).run();
}

export async function deleteCoupon(db: D1Database, id: string): Promise<void> {
  if (!db) return;
  await db.prepare("DELETE FROM coupons WHERE id = ?").bind(id).run();
}

export async function getAllNfcCards(db: D1Database): Promise<NfcCard[]> {
  if (!db) return [];
  const { results } = await db.prepare("SELECT * FROM nfc_cards").all<NfcCard>();
  return results ?? [];
}

export async function getNfcCardBySlug(db: D1Database, slug: string): Promise<NfcCard | null> {
  if (!db) return null;
  const result = await db.prepare("SELECT * FROM nfc_cards WHERE slug = ?").bind(slug).first<NfcCard>();
  return result ?? null;
}

export async function upsertNfcCard(db: D1Database, card: NfcCard): Promise<void> {
  if (!db) return;
  await db.prepare("INSERT INTO nfc_cards (id, slug, title, scans) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, title=excluded.title, scans=excluded.scans").bind(card.id, card.slug, card.title, card.scans).run();
}

export async function deleteNfcCard(db: D1Database, id: string): Promise<void> {
  if (!db) return;
  await db.prepare("DELETE FROM nfc_cards WHERE id = ?").bind(id).run();
}

export async function incrementNfcScanCount(db: D1Database, slug: string): Promise<void> {
  if (!db) return;
  await db.prepare("UPDATE nfc_cards SET scans = scans + 1 WHERE slug = ?").bind(slug).run();
}

export async function getNfcScanStats(db: D1Database): Promise<any> {
  if (!db) return { total_scans: 0, top_cards: [] };
  const total = await db.prepare("SELECT SUM(scans) as total FROM nfc_cards").first<{ total: number }>();
  const top = await db.prepare("SELECT title, scans FROM nfc_cards ORDER BY scans DESC LIMIT 5").all<any>();
  return { total_scans: total?.total ?? 0, top_cards: top.results ?? [] };
}

export async function getAllMessagingChannels(db: D1Database): Promise<MessagingChannel[]> {
  if (!db) return [];
  const { results } = await db.prepare("SELECT * FROM messaging_channels").all<MessagingChannel>();
  return results ?? [];
}

export async function upsertMessagingChannel(db: D1Database, channel: MessagingChannel): Promise<void> {
  if (!db) return;
  await db.prepare("INSERT INTO messaging_channels (id, name, type, config) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, config=excluded.config").bind(channel.id, channel.name, channel.type, JSON.stringify(channel.config)).run();
}

export async function deleteMessagingChannel(db: D1Database, id: string): Promise<void> {
  if (!db) return;
  await db.prepare("DELETE FROM messaging_channels WHERE id = ?").bind(id).run();
}

export async function getContacts(db: D1Database): Promise<Contact[]> {
  if (!db) return [];
  const { results } = await db.prepare("SELECT * FROM contacts").all<Contact>();
  return results ?? [];
}

export async function upsertContact(db: D1Database, contact: Contact): Promise<void> {
  if (!db) return;
  await db.prepare("INSERT INTO contacts (id, name, email, phone) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, email=excluded.email, phone=excluded.phone").bind(contact.id, contact.name, contact.email, contact.phone).run();
}

export async function deleteContact(db: D1Database, id: string): Promise<void> {
  if (!db) return;
  await db.prepare("DELETE FROM contacts WHERE id = ?").bind(id).run();
}

export async function getMessageTemplates(db: D1Database): Promise<MessageTemplate[]> {
  if (!db) return [];
  const { results } = await db.prepare("SELECT * FROM message_templates").all<MessageTemplate>();
  return results ?? [];
}

export async function upsertMessageTemplate(db: D1Database, template: MessageTemplate): Promise<void> {
  if (!db) return;
  await db.prepare("INSERT INTO message_templates (id, name, content) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, content=excluded.content").bind(template.id, template.name, template.content).run();
}

export async function deleteMessageTemplate(db: D1Database, id: string): Promise<void> {
  if (!db) return;
  await db.prepare("DELETE FROM message_templates WHERE id = ?").bind(id).run();
}
