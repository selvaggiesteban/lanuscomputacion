import { postventaEmail } from "./email";

export type PostventaRecord = {
  id: number;
  order_id: string;
  product_id: string | null;
  product_title: string | null;
  related_id: string | null;
  related_title: string | null;
  related_slug: string | null;
  subject: string;
  body: string;
  status: "pending" | "sent";
  sent_at: string | null;
  created_at: string;
};

async function pickRelated(
  db: D1Database,
  categoryId: string | null,
  categoryName: string | null,
  excludeId: string
): Promise<{ id: string; title: string; slug: string } | null> {
  if (categoryId) {
    const withStock = await db
      .prepare(
        `SELECT id, title, slug FROM products
         WHERE category_id = ? AND id != ? AND status = 'published'
           AND available_qty > 0 AND price > 0
         ORDER BY sold_qty DESC, created_at DESC LIMIT 1`
      )
      .bind(categoryId, excludeId)
      .first<{ id: string; title: string; slug: string }>();
    if (withStock) return withStock;

    const sameCategory = await db
      .prepare(
        `SELECT id, title, slug FROM products
         WHERE category_id = ? AND id != ? AND status = 'published' AND price > 0
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(categoryId, excludeId)
      .first<{ id: string; title: string; slug: string }>();
    if (sameCategory) return sameCategory;
  }

  if (categoryName) {
    const byName = await db
      .prepare(
        `SELECT id, title, slug FROM products
         WHERE category_name = ? AND id != ? AND status = 'published' AND price > 0
         ORDER BY created_at DESC LIMIT 1`
      )
      .bind(categoryName, excludeId)
      .first<{ id: string; title: string; slug: string }>();
    if (byName) return byName;
  }

  return null;
}

/**
 * Crea (idempotente) el registro de postventa de una orden: producto
 * comprado + producto relacionado sugerido + asunto/cuerpo del email.
 */
export async function ensurePostventaRecord(db: D1Database, orderId: string): Promise<void> {
  try {
    const existing = await db
      .prepare("SELECT id FROM postventa_emails WHERE order_id = ?")
      .bind(orderId)
      .first();
    if (existing) return;

    const order = await db
      .prepare("SELECT id, product_id FROM orders WHERE id = ?")
      .bind(orderId)
      .first<{ id: string; product_id: string | null }>();
    if (!order) return;

    let productId = order.product_id;
    let productTitle = "";

    const item = await db
      .prepare(
        "SELECT product_id, product_title FROM order_items WHERE order_id = ? ORDER BY rowid LIMIT 1"
      )
      .bind(orderId)
      .first<{ product_id: string; product_title: string }>();
    if (item) {
      productId = item.product_id;
      productTitle = item.product_title;
    }
    if (!productId) return;

    const product = await db
      .prepare("SELECT id, title, category_id, category_name FROM products WHERE id = ?")
      .bind(productId)
      .first<{ id: string; title: string; category_id: string | null; category_name: string | null }>();
    if (!product) return;
    if (!productTitle) productTitle = product.title;

    const related = await pickRelated(db, product.category_id, product.category_name, product.id);
    const { subject, html } = postventaEmail({
      orderId,
      productTitle,
      related: related ? { title: related.title, slug: related.slug } : null,
    });

    await db
      .prepare(
        `INSERT OR IGNORE INTO postventa_emails
           (order_id, product_id, product_title, related_id, related_title, related_slug, subject, body, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      )
      .bind(
        orderId,
        product.id,
        productTitle,
        related?.id ?? null,
        related?.title ?? null,
        related?.slug ?? null,
        subject,
        html
      )
      .run();
  } catch (e) {
    console.error("[postventa] ensurePostventaRecord error:", e);
  }
}

/**
 * Backfill: crea registros pendientes para órdenes que no tienen uno.
 * Devuelve la cantidad de órdenes procesadas.
 */
export async function backfillPostventa(db: D1Database, limit = 500): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT o.id FROM orders o
       LEFT JOIN postventa_emails p ON p.order_id = o.id
       WHERE p.id IS NULL
       ORDER BY o.created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<{ id: string }>();

  let count = 0;
  for (const row of results || []) {
    await ensurePostventaRecord(db, row.id);
    count++;
  }
  return count;
}
