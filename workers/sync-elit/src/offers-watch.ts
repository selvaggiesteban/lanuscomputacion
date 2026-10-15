// offers-watch.ts — detects changes in the public /ofertas feed and emails
// the operator (selvaggi.esteban@gmail.com) after each hourly sync.
//
// Modular pipeline: snapshot -> fingerprint -> diff -> notify. The snapshot
// covers active promotions plus the number of products matching them (the
// exact data /ofertas renders). ELIT is the only configured provider, so any
// catalog change flows through this same snapshot. Adding a new provider or a
// new notification channel only requires a new snapshot source or sender.

import { connect } from "cloudflare:sockets";

export interface WatchPromo {
  id: string;
  name: string;
  type: string;
  value: number;
  applies_to: string;
  target_id: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface OffersSnapshot {
  promotions: WatchPromo[];
  product_count: number;
}

export interface OfferChanges {
  added: WatchPromo[];
  removed: WatchPromo[];
  previousCount: number;
  productCount: number;
}

const ALERT_TO = "selvaggi.esteban@gmail.com";
const SITE = "https://lanuscomputacion.com";

const PROMO_W = `
  is_active = 1
  AND (start_date IS NULL OR start_date <= datetime('now'))
  AND (end_date IS NULL OR end_date >= datetime('now'))`;

const PR_W = `
  pr.is_active = 1
  AND (pr.start_date IS NULL OR pr.start_date <= datetime('now'))
  AND (pr.end_date IS NULL OR pr.end_date >= datetime('now'))`;

const STATE_DDL = `
  CREATE TABLE IF NOT EXISTS offers_watch_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    fingerprint TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`;

function fmtValue(p: WatchPromo): string {
  return p.type === "percentage" ? `${p.value}% OFF` : `$${p.value}`;
}

function fmtScope(p: WatchPromo): string {
  if (p.applies_to === "all") return "todo el catálogo";
  if (p.applies_to === "category") return `categoría ${p.target_id}`;
  return `producto ${p.target_id}`;
}

export async function getOffersSnapshot(db: D1Database): Promise<OffersSnapshot> {
  const { results: promotions } = await db.prepare(
    `SELECT id, name, type, value, applies_to, target_id, start_date, end_date
     FROM promotions
     WHERE ${PROMO_W}
     ORDER BY id`
  ).all<WatchPromo>();

  let productCount = 0;
  if (promotions.length > 0) {
    const row = await db.prepare(`
      SELECT COUNT(*) AS c
      FROM products
      WHERE status = 'published' AND available_qty > 0 AND price > 0
        AND (
          EXISTS (SELECT 1 FROM promotions pr WHERE ${PR_W} AND pr.applies_to = 'all')
          OR category_id IN (SELECT pr.target_id FROM promotions pr WHERE ${PR_W} AND pr.applies_to = 'category')
          OR id IN (SELECT pr.target_id FROM promotions pr WHERE ${PR_W} AND pr.applies_to = 'product')
        )
    `).first<{ c: number }>();
    productCount = row?.c ?? 0;
  }

  return { promotions, product_count: productCount };
}

export function diffSnapshots(prev: OffersSnapshot, next: OffersSnapshot): OfferChanges {
  const prevIds = new Set(prev.promotions.map((p) => p.id));
  const nextIds = new Set(next.promotions.map((p) => p.id));
  return {
    added: next.promotions.filter((p) => !prevIds.has(p.id)),
    removed: prev.promotions.filter((p) => !nextIds.has(p.id)),
    previousCount: prev.product_count,
    productCount: next.product_count,
  };
}

async function fingerprintOf(s: OffersSnapshot): Promise<string> {
  const canonical = JSON.stringify({
    promotions: [...s.promotions].sort((a, b) => a.id.localeCompare(b.id)),
    product_count: s.product_count,
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadState(db: D1Database): Promise<{ fingerprint: string; snapshot: string } | null> {
  try {
    return await db
      .prepare("SELECT fingerprint, snapshot FROM offers_watch_state WHERE id = 1")
      .first<{ fingerprint: string; snapshot: string }>();
  } catch {
    return null;
  }
}

async function saveState(db: D1Database, fingerprint: string, snapshot: OffersSnapshot): Promise<void> {
  await db
    .prepare(
      `INSERT INTO offers_watch_state (id, fingerprint, snapshot, updated_at)
       VALUES (1, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         fingerprint = excluded.fingerprint,
         snapshot = excluded.snapshot,
         updated_at = excluded.updated_at`
    )
    .bind(fingerprint, JSON.stringify(snapshot))
    .run();
}

function layout(title: string, bodyRows: string): string {
  return `
  <!DOCTYPE html>
  <html lang="es">
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;">
      <div style="background:#7C3AED;padding:24px;text-align:center;">
        <h1 style="margin:0;font-size:22px;color:#ffffff;">Lanús Computación</h1>
        <p style="margin:6px 0 0;font-size:12px;color:#E9D5FF;letter-spacing:2px;text-transform:uppercase;">Alerta de ofertas</p>
      </div>
      <div style="padding:32px 24px;color:#333333;">
        <h2 style="margin:0 0 16px;font-size:20px;color:#333333;">${title}</h2>
        ${bodyRows}
      </div>
      <div style="padding:20px 24px;text-align:center;border-top:1px solid #eeeeee;">
        <a href="${SITE}/ofertas" style="display:inline-block;background:#7C3AED;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:600;">Ver ofertas en la tienda</a>
      </div>
      <div style="padding:20px 24px;text-align:center;color:#999999;font-size:12px;border-top:1px solid #eeeeee;">
        <p style="margin:0;">Lanús Computación · lanuscomputacion.com</p>
        <p style="margin:6px 0 0;">Alerta automática del sync horario del catálogo.</p>
      </div>
    </div>
  </body>
  </html>`;
}

function baselineHtml(s: OffersSnapshot): string {
  const rows = s.promotions
    .map(
      (p) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;">${p.name} — ${fmtValue(p)} — ${fmtScope(p)}</td></tr>`
    )
    .join("");
  return layout(
    "Seguimiento de ofertas activado",
    `
    <p style="margin:0 0 12px;">A partir de ahora se te avisará por email cada vez que cambien las ofertas publicadas en la tienda.</p>
    <p style="margin:0 0 4px;"><strong>Estado inicial</strong></p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">${rows || "<tr><td style='padding:8px 0;'>Sin promociones activas</td></tr>"}</table>
    <p style="margin:0;color:#666666;font-size:14px;">${s.product_count} producto(s) en oferta actualmente.</p>`
  );
}

function changesHtml(s: OffersSnapshot, c: OfferChanges): string {
  const list = (items: WatchPromo[], label: string, color: string) =>
    items.length === 0
      ? ""
      : `<p style="margin:12px 0 4px;color:${color};font-weight:600;">${label}</p>
         <table style="width:100%;border-collapse:collapse;">${items
           .map(
             (p) =>
               `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:14px;">${p.name} — ${fmtValue(p)} — ${fmtScope(p)}</td></tr>`
           )
           .join("")}</table>`;

  const countChanged = c.previousCount !== c.productCount;
  return layout(
    "Cambios detectados en las ofertas",
    `
    <p style="margin:0 0 8px;">Las ofertas publicadas en la tienda fueron modificadas.</p>
    ${list(c.added, "Promociones agregadas", "#16a34a")}
    ${list(c.removed, "Promociones retiradas", "#dc2626")}
    ${
      countChanged
        ? `<p style="margin:16px 0 4px;"><strong>Productos en oferta:</strong> ${c.previousCount} → ${c.productCount}</p>`
        : ""
    }
    <p style="margin:16px 0 0;color:#666666;font-size:14px;">Total vigente: ${s.promotions.length} promoción(es), ${s.product_count} producto(s) en oferta.</p>`
  );
}

async function sendEmail(
  env: { GMAIL_USER?: string; GMAIL_APP_PASSWORD?: string },
  subject: string,
  html: string
): Promise<boolean> {
  const user = env.GMAIL_USER;
  const pass = env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.log("[offers-watch] GMAIL_USER/GMAIL_APP_PASSWORD not configured — email skipped");
    return false;
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const socket = connect({ hostname: "smtp.gmail.com", port: 465 }, { secureTransport: "on" });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  let buf = "";
  const timeout = setTimeout(() => { try { socket.close(); } catch {} }, 20000);

  const write = (line: string) => writer.write(encoder.encode(line + "\r\n"));

  function b64utf8(s: string): string {
    const bytes = encoder.encode(s);
    let bin = "";
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  async function readReply(): Promise<number> {
    for (;;) {
      let scan = 0;
      let pos = buf.indexOf("\r\n", scan);
      let last: string | null = null;
      while (pos !== -1) {
        last = buf.slice(scan, pos);
        scan = pos + 2;
        pos = buf.indexOf("\r\n", scan);
      }
      if (last !== null && /^\d{3} [^-]/.test(last)) {
        buf = buf.slice(scan);
        return parseInt(last.slice(0, 3), 10);
      }
      const { done, value } = await reader.read();
      if (done) throw new Error("SMTP: conexión cerrada inesperadamente");
      if (value) buf += decoder.decode(value, { stream: true });
    }
  }

  async function expect(expected: number, step: string) {
    const code = await readReply();
    if (code !== expected) {
      throw new Error(`SMTP ${step}: esperaba ${expected}, recibió ${code}`);
    }
  }

  try {
    await expect(220, "saludo");
    await write("EHLO lanuscomputacion.com");
    await expect(250, "EHLO");
    await write("AUTH LOGIN");
    await expect(334, "AUTH LOGIN");
    await write(b64utf8(user));
    await expect(334, "usuario");
    await write(b64utf8(pass));
    await expect(235, "autenticación");
    await write(`MAIL FROM:<${user}>`);
    await expect(250, "MAIL FROM");
    await write(`RCPT TO:<${ALERT_TO}>`);
    await expect(250, "RCPT TO");
    await write("DATA");
    await expect(354, "DATA");

    const bodyB64 = (b64utf8(html).match(/.{1,76}/g) || []).join("\r\n");
    const message = [
      `From: =?UTF-8?B?${b64utf8("Lanús Computación")}?= <${user}>`,
      `To: <${ALERT_TO}>`,
      `Subject: =?UTF-8?B?${b64utf8(subject)}?=`,
      "MIME-Version: 1.0",
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      bodyB64,
      ".",
    ].join("\r\n");
    await write(message);
    await expect(250, "envío");
    await write("QUIT");
    return true;
  } catch (err) {
    console.error("[offers-watch] SMTP error:", String(err));
    return false;
  } finally {
    clearTimeout(timeout);
    try { writer.releaseLock(); } catch {}
    try { reader.releaseLock(); } catch {}
    try { socket.close(); } catch {}
  }
}

export async function notifyOffersChanges(env: {
  lanus_catalog: D1Database;
  GMAIL_USER?: string;
  GMAIL_APP_PASSWORD?: string;
}): Promise<void> {
  const db = env.lanus_catalog;

  try {
    await db.prepare(STATE_DDL).run();
  } catch (err) {
    console.error("[offers-watch] Could not ensure state table:", err);
    return;
  }

  const snapshot = await getOffersSnapshot(db);
  const fingerprint = await fingerprintOf(snapshot);
  const prev = await loadState(db);

  if (prev && prev.fingerprint === fingerprint) return;

  let sent: boolean;
  if (!prev) {
    sent = await sendEmail(
      env,
      `Seguimiento de ofertas activado — ${snapshot.promotions.length} promociones, ${snapshot.product_count} productos`,
      baselineHtml(snapshot)
    );
  } else {
    const before: OffersSnapshot = JSON.parse(prev.snapshot);
    const changes = diffSnapshots(before, snapshot);
    sent = await sendEmail(
      env,
      `Ofertas actualizadas — ${changes.added.length} nueva(s), ${changes.removed.length} retirada(s), ${snapshot.product_count} productos`,
      changesHtml(snapshot, changes)
    );
  }

  if (sent) {
    try {
      await saveState(db, fingerprint, snapshot);
    } catch (err) {
      console.error("[offers-watch] Could not persist state:", err);
    }
  }
}
