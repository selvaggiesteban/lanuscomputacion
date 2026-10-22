export type EmailTemplate = "confirmation" | "status_update";

/**
 * Marca una plantilla transaccional como enviada para una orden.
 * Idempotente: si ya existe, actualiza subject y sent_at (último envío gana).
 */
export async function markEmailSent(
  db: D1Database,
  orderId: string,
  template: EmailTemplate,
  subject: string
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO transactional_emails (order_id, template, subject, sent_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(order_id, template) DO UPDATE SET
           subject = excluded.subject,
           sent_at = datetime('now')`
      )
      .bind(orderId, template, subject)
      .run();
  } catch (e) {
    console.error("[emaillog] markEmailSent error:", e);
  }
}

/**
 * Devuelve { [order_id]: { confirmation: sent_at, status_update: sent_at } }
 * para el lote de órdenes indicado.
 */
export async function getEmailLog(
  db: D1Database,
  orderIds: string[]
): Promise<Record<string, Record<string, string>>> {
  const log: Record<string, Record<string, string>> = {};
  if (orderIds.length === 0) return log;
  try {
    const placeholders = orderIds.map(() => "?").join(",");
    const { results } = await db
      .prepare(
        `SELECT order_id, template, sent_at FROM transactional_emails WHERE order_id IN (${placeholders})`
      )
      .bind(...orderIds)
      .all<{ order_id: string; template: string; sent_at: string }>();
    for (const r of results || []) {
      if (!log[r.order_id]) log[r.order_id] = {};
      log[r.order_id][r.template] = r.sent_at;
    }
  } catch (e) {
    console.error("[emaillog] getEmailLog error:", e);
  }
  return log;
}
