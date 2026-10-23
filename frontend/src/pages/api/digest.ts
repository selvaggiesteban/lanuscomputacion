import type { APIRoute } from "astro";
import { sendEmail } from "../../lib/email";

// POST /api/digest — email del dueño con pedidos pendientes + ideas para redes
// (NVIDIA NIM) + barrido de postventa + recuperación de carritos abandonados +
// resumen de eventos Mercado Libre de las últimas 12 horas (port del worker
// workers/ml-digest, que no está desplegado: se corre desde este endpoint).
// Auth: Authorization: Bearer <DIGEST_TOKEN> (Pages secret). Trigger: cron
// externo (cron-job.org) o worker lanus-digest-trigger, 9:00 y 17:00 ART.
// Destinatario: env.GMAIL_USER (Pages secret). Todas las fechas se formatean
// en America/Argentina/Buenos_Aires (TZ_ART).
// Dry run: body { "dry_run": true } o query param ?dry_run=1 → solo reporta,
// no envía emails.

const SITE = "https://lanuscomputacion.com";
const TZ_ART = "America/Argentina/Buenos_Aires";
const NIM_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const NIM_MODEL = "deepseek-ai/deepseek-v4.1-flash";

interface DigestEnv {
  DB: D1Database;
  DIGEST_TOKEN?: string;
  NVIDIA_API_KEY?: string;
  GMAIL_USER?: string;
  GMAIL_APP_PASSWORD?: string;
}

// Date → "dd/MM/yyyy HH:mm" en TZ_ART (timezone explícita, sin depender del
// offset fijo -3 ni de la timezone del runtime).
function fmtDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ_ART,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("day")}/${g("month")}/${g("year")} ${g("hour")}:${g("minute")}`;
}

// "YYYY-MM-DD HH:MM:SS" (UTC, datetime('now')) → Date. Acepta también ISO
// con "T"/"Z"/offset por si la columna viene en otro formato.
function parseUtc(utc: string): Date {
  const iso = utc.includes("T") ? utc : utc.replace(" ", "T");
  return new Date(/(Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`);
}

function fmtArt(utc: string): string {
  return fmtDate(parseUtc(utc));
}

function artNow(): string {
  return fmtDate(new Date());
}

async function ownerDigest(env: DigestEnv, to: string | undefined, dryRun: boolean) {
  const orders = (
    await env.DB.prepare(
      `SELECT id, payment_method, status, customer_name, customer_email,
              customer_phone, address, total_price, created_at
         FROM orders WHERE status = 'pending'
        ORDER BY created_at DESC LIMIT 100`
    ).all<{
      id: string;
      payment_method: string;
      status: string;
      customer_name: string;
      customer_email: string;
      customer_phone: string | null;
      address: string | null;
      total_price: number;
      created_at: string;
    }>()
  ).results || [];

  if (orders.length === 0) return { pending: 0, sent: false, reason: "sin pedidos pendientes" };

  const ids = orders.map((o) => `'${o.id.replace(/'/g, "''")}'`).join(",");
  const items = (
    await env.DB.prepare(
      `SELECT order_id, product_id, product_title, quantity, subtotal
         FROM order_items WHERE order_id IN (${ids})`
    ).all<{ order_id: string; product_id: string; product_title: string; quantity: number; subtotal: number }>()
  ).results || [];
  const byOrder = new Map<string, typeof items>();
  for (const it of items) {
    const arr = byOrder.get(it.order_id) || [];
    arr.push(it);
    byOrder.set(it.order_id, arr);
  }

  const lines: string[] = [];
  for (const o of orders) {
    const its = byOrder.get(o.id) || [];
    const head = its.length
      ? its.map((i) => `${i.quantity}× ${i.product_title} (${i.product_id}) — $${i.subtotal}`).join(" + ")
      : `Total $${o.total_price}`;
    lines.push(
      `${head}, ${o.customer_name}, ${o.customer_email} / ${o.customer_phone ?? "-"}, ` +
        `${o.payment_method} ${o.status}, ${fmtArt(o.created_at)}. (#${o.id.slice(0, 8)})`
    );
    if (o.address) lines.push(`    Dirección: ${o.address}`);
  }

  const subject = `Digest de pedidos — ${orders.length} pendientes — ${artNow()} ART`;
  const text = `Pedidos pendientes (${orders.length}) — ${artNow()} ART\n\n${lines.join("\n")}\n`;

  if (dryRun) return { pending: orders.length, sent: false, dry_run: true, subject };
  const r = await sendEmail(env, { to: to ?? "", subject, text });
  if (!r.success) return { pending: orders.length, sent: false, error: r.error };
  return { pending: orders.length, sent: true, subject };
}

async function socialIdeas(env: DigestEnv, to: string | undefined, dryRun: boolean) {
  if (!env.NVIDIA_API_KEY) return { skipped: "NVIDIA_API_KEY no configurado (Pages secret)" };

  const prods = (
    await env.DB.prepare(
      `SELECT title, price, sold_qty, category_name
         FROM products
        WHERE status = 'published' AND available_qty > 0 AND price > 0
        ORDER BY sold_qty DESC, created_at DESC LIMIT 8`
    ).all<{ title: string; price: number; sold_qty: number; category_name: string | null }>()
  ).results || [];
  if (prods.length === 0) return { skipped: "sin productos destacados" };

  const list = prods
    .map(
      (p, i) =>
        `${i + 1}. ${p.title} — $${p.price}` +
        `${p.category_name ? ` (${p.category_name})` : ""}` +
        `${p.sold_qty ? ` — ${p.sold_qty} vendidos` : ""}`
    )
    .join("\n");

  const res = await fetch(NIM_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.NVIDIA_API_KEY}` },
    body: JSON.stringify({
      model: NIM_MODEL,
      temperature: 0.9,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content:
            "Sos el community manager de Lanús Computación, una tienda de tecnología en Lanús, Buenos Aires, Argentina. " +
            "Escribís en español rioplatense (voseo), tono cercano y comercial. Máximo 5 hashtags por idea.",
        },
        {
          role: "user",
          content:
            "Generá 3 ideas de posts para Instagram/Facebook de Lanús Computación para publicar hoy. " +
            "Variá el formato (oferta, novedad, engagement, carrusel). Basate en estos productos destacados:\n" +
            `${list}\n\nDevolvé solo las ideas: título corto, cuerpo del post y llamado a la acción.`,
        },
      ],
    }),
  });
  if (!res.ok) return { error: `NIM HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) return { error: "NIM devolvió contenido vacío" };

  if (dryRun) return { dry_run: true, chars: text.length, preview: text.slice(0, 200) };
  const subject = `Ideas para redes — ${artNow()} ART`;
  const r = await sendEmail(env, { to: to ?? "", subject, text });
  if (!r.success) return { error: r.error };
  return { sent: true, subject };
}

// Eventos de Mercado Libre de las últimas 12 horas: contenido portado del
// worker workers/ml-digest (scheduled), que no está desplegado. Si la tabla
// meli_events todavía no existe (migración pendiente), se reporta como
// omitido sin frenar el resto del digest.
interface MlEventRow {
  created_at?: string | null;
  event_type?: string | null;
  item_id?: string | null;
  payload?: string | null;
  status?: string | null;
  message?: string | null;
  entity_id?: string | null;
}

async function mlEventsDigest(env: DigestEnv, to: string | undefined, dryRun: boolean) {
  let rows: MlEventRow[] = [];
  try {
    rows =
      (
        await env.DB.prepare(
          `SELECT * FROM meli_events
            WHERE created_at >= datetime('now', '-12 hours')
            ORDER BY created_at DESC LIMIT 100`
        ).all<MlEventRow>()
      ).results || [];
  } catch {
    return { skipped: "tabla meli_events no disponible (migración pendiente)" };
  }

  if (rows.length === 0) {
    return { events: 0, sent: false, reason: "sin eventos en las últimas 12 horas" };
  }

  const lines = rows.map((e) => {
    const type = e.event_type ?? e.status ?? "evento";
    const item = e.item_id ?? e.entity_id ?? "-";
    const detail = String(e.message ?? e.payload ?? "").slice(0, 300);
    const when = e.created_at ? fmtArt(String(e.created_at)) : "-";
    return `[${when}] ${type}: ${item}${detail ? ` — ${detail}` : ""}`;
  });

  const subject = `Resumen de eventos Mercado Libre — ${rows.length} en 12 h — ${artNow()} ART`;
  const text =
    `Eventos de Mercado Libre (últimas 12 horas) — ${artNow()} ART\n\n` +
    `${lines.join("\n")}\n`;

  if (dryRun) return { events: rows.length, sent: false, dry_run: true, subject };
  const r = await sendEmail(env, { to: to ?? "", subject, text });
  if (!r.success) return { events: rows.length, sent: false, error: r.error };
  return { events: rows.length, sent: true, subject };
}

async function postventaSweep(env: DigestEnv, dryRun: boolean) {
  const rows = (
    await env.DB.prepare(
      `SELECT p.id AS pid, p.order_id, p.subject, p.body, o.customer_email
         FROM postventa_emails p JOIN orders o ON o.id = p.order_id
        WHERE p.status = 'pending' AND o.status != 'cancelled'
          AND o.customer_email IS NOT NULL AND o.customer_email != ''
          AND o.created_at <= datetime('now', '-3 days')
        ORDER BY o.created_at DESC LIMIT 15`
    ).all<{ pid: number; order_id: string; subject: string; body: string; customer_email: string }>()
  ).results || [];

  if (rows.length === 0 || dryRun) return { pending: rows.length, sent: 0, dry_run: dryRun || undefined };

  let sent = 0;
  const failed: string[] = [];
  for (const r of rows) {
    const res = await sendEmail(env, { to: r.customer_email, subject: r.subject, html: r.body });
    if (res.success) {
      sent++;
      await env.DB.prepare(
        "UPDATE postventa_emails SET status = 'sent', sent_at = datetime('now') WHERE id = ?"
      ).bind(r.pid).run();
    } else {
      failed.push(`#${r.order_id.slice(0, 8)}: ${res.error}`);
    }
  }
  return { pending: rows.length, sent, failed: failed.length ? failed : undefined };
}

async function abandonedSweep(env: DigestEnv, dryRun: boolean) {
  const rows = (
    await env.DB.prepare(
      `SELECT session_id, items, total, customer_name, customer_email, page, last_seen_at
         FROM abandoned_carts
        WHERE order_id IS NULL AND recovery_sent_at IS NULL
          AND customer_email IS NOT NULL AND customer_email != ''
          AND last_seen_at <= datetime('now', '-30 minutes')
          AND last_seen_at >= datetime('now', '-7 days')
        ORDER BY last_seen_at DESC LIMIT 10`
    ).all<{
      session_id: string;
      items: string;
      total: number;
      customer_name: string | null;
      customer_email: string;
      page: string | null;
      last_seen_at: string;
    }>()
  ).results || [];

  if (rows.length === 0 || dryRun) return { candidates: rows.length, sent: 0, dry_run: dryRun || undefined };

  let sent = 0;
  const failed: string[] = [];
  for (const c of rows) {
    let itemLines = "";
    try {
      const parsed = JSON.parse(c.items) as { title: string; quantity: number; price: number }[];
      itemLines = parsed
        .map((i) => `- ${i.quantity}× ${i.title} — $${Math.round(i.quantity * i.price * 100) / 100}`)
        .join("\n");
    } catch {
      itemLines = "(productos del carrito)";
    }
    const link = c.page && c.page.startsWith("/") ? `${SITE}${c.page}` : `${SITE}/`;
    const text =
      `Hola ${c.customer_name || "!"},\n\n` +
      `Te quedaste con esto en el carrito en Lanús Computación:\n\n${itemLines}\n\n` +
      `Total: $${c.total}\nCompletá tu compra: ${link}\n\n` +
      `Si ya compraste, ignorá este mensaje.\nLanús Computación — ${SITE}`;
    const res = await sendEmail(env, {
      to: c.customer_email,
      subject: "Tu carrito te espera en Lanús Computación",
      text,
    });
    if (res.success) {
      sent++;
      await env.DB.prepare(
        "UPDATE abandoned_carts SET recovery_sent_at = datetime('now') WHERE session_id = ?"
      ).bind(c.session_id).run();
    } else {
      failed.push(`${c.session_id.slice(0, 8)}: ${res.error}`);
    }
  }
  return { candidates: rows.length, sent, failed: failed.length ? failed : undefined };
}

export const POST: APIRoute = async ({ locals, request }) => {
  const env = (locals.runtime as any).env as DigestEnv;

  if (!env.DIGEST_TOKEN) {
    return new Response(JSON.stringify({ error: "DIGEST_TOKEN no configurado (Pages secret)" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const auth = request.headers.get("Authorization") || "";
  if (auth !== `Bearer ${env.DIGEST_TOKEN}`) {
    return new Response(JSON.stringify({ error: "No autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Dry run: query param ?dry_run=1 (cómodo para cron-job.org) o body JSON.
  const qp = new URL(request.url).searchParams.get("dry_run");
  let dryRun = qp === "1" || qp === "true";
  if (!dryRun) {
    try {
      const body = await request.json();
      dryRun = Boolean((body as { dry_run?: boolean })?.dry_run);
    } catch {
      /* body vacío ok */
    }
  }

  const to = env.GMAIL_USER;
  if (!dryRun && !to) {
    return new Response(JSON.stringify({ error: "GMAIL_USER no configurado (Pages secret): falta el destinatario del digest" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!dryRun && !env.GMAIL_APP_PASSWORD) {
    return new Response(JSON.stringify({ error: "GMAIL_APP_PASSWORD no configurado (Pages secret)" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const report: Record<string, unknown> = { ok: true, dry_run: dryRun, tz: TZ_ART, at: artNow() };
  const errors: string[] = [];

  const run = async (key: string, fn: () => Promise<unknown>) => {
    try {
      report[key] = await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      report[key] = { error: msg };
      errors.push(`${key}: ${msg}`);
    }
  };

  await run("owner_digest", () => ownerDigest(env, to, dryRun));
  await run("social_ideas", () => socialIdeas(env, to, dryRun));
  await run("ml_events", () => mlEventsDigest(env, to, dryRun));
  await run("postventa", () => postventaSweep(env, dryRun));
  await run("abandoned", () => abandonedSweep(env, dryRun));

  if (errors.length) report.ok = false;
  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
