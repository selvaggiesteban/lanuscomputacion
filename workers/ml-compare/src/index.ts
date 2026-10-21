import puppeteer from '@cloudflare/puppeteer';

// lanus-ml-compare — Worker con cron diario (13:00 UTC / 10:00 ART) que
// contrasta los precios de los productos de la campaña (KV `snapshot:latest`,
// la misma que alimenta /ofertas y /lista/) contra publicaciones reales de
// MercadoLibre Argentina. Guarda el informe en KV `ml-compare:latest`.
//
// Proveedor de datos: scraping puro, sin API keys ni tokens de terceros.
// Un browser (Browser Run, Chrome headless de Cloudflare) consulta
// html.duckduckgo.com/html/?q=site:articulo.mercadolibre.com.ar <producto>
// y parsea los snippets de los resultados, que traen el precio publicado en
// ML. Restricciones conocidas: la API de ML responde 403 sin token, la web
// de ML muestra login wall ("suspicious traffic") a los bots, DDG devuelve
// un challenge "anomaly" al fetch plano desde IPs de datacenter (por eso el
// browser), y el límite free de Browser Run es 10 min/día.
//
// Endpoints:
//   GET|POST /refresh  (header x-refresh-secret = REFRESH_SECRET) → corre el contraste (?limit=&offset=)
//   GET /report.html   informe HTML (default /report)
//   GET /report.json   informe JSON
//   GET /report.csv    informe CSV
//   GET /status        progreso del último refresh
//   GET /info          estado del worker (último informe)
//   GET /test-ddg-web  debug de una búsqueda (?q=&mode=html|react)

export interface Env {
  FLYERS: KVNamespace;
  BROWSER: { fetch: typeof fetch };
  REFRESH_SECRET?: string;
}

type Producto = {
  id: string;
  title: string;
  brand: string;
  price: number;
  stock: number;
  slug: string;
  url: string;
};

type Snapshot = {
  fecha: string;
  secciones: { key: string; title: string; productos: Producto[] }[];
};

type RawHit = {
  title: string;
  url: string;
  text: string;
};

type MlPick = RawHit & { price: number };

type ItemResult = {
  id: string;
  section: string;
  title: string;
  url: string;
  our_price: number;
  ml_price: number | null;
  ml_title: string | null;
  ml_url: string | null;
  source: 'ddg' | null;
  diff_pct: number | null;
  cheaper: 'us' | 'ml' | 'tie' | 'no_data';
};

type Report = {
  ran_at: string;
  trigger: string;
  provider: 'ddg';
  snapshot_fecha: string;
  total: number;
  with_price: number;
  summary: { us: number; ml: number; tie: number; no_data: number };
  items: ItemResult[];
};

const STOP = new Set([
  'camara', 'camaras', 'de', 'para', 'con', 'sin', 'los', 'las', 'una', 'un',
  'nuevo', 'nueva', 'negro', 'negra', 'blanco', 'blanca', 'gris', 'gamer',
  'gaming', 'oferta', 'ofertas', 'calidad', 'cable', 'cables', 'pack',
  'combo', 'set', 'kit', 'libre', 'freedos', 'win', 'windows', 'home',
  'pro', 'plus', 'max', 'mini', 'full', 'hd', 'fhd', 'uhd', 'ips', 'va',
  'tn', 'led', 'lcd', 'wifi', 'wireless', 'usb', 'rj45', 'gb', 'tb', 'mp',
  'hz', 'pulgadas', 'pulg', 'polegadas', 'touch', 'digitador', 'teclado',
  'raton', 'mochila', 'fundas', 'funda', 'termica', 'portatil', 'escritorio',
  'oficina', 'hogar', 'trabajo', 'estudio', 'interna', 'interno', 'exterior',
  'energia', 'solar', 'panel', 'universal', 'carga', 'cargador', 'bateria',
  'baterias', 'soporte', 'base', 'rack', 'riel', 'sd', 'dual', 'doble',
  'triple', 'sencillo', 'color', 'colores', 'sur', 'argentina', 'envio',
  'gratis', 'cuotas', 'meses', 'interior',
]);

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

function norm(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tokens(s: string): string[] {
  return norm(s).split(/[^a-z0-9]+/).filter(Boolean);
}

// El candidato de ML pasa si: (a) contiene algún token "modelo" de nuestro
// título (con dígito y largo >= 3: te1916s, h8c, wr1200e, ax1500...),
// aceptando variantes con sufijo ("512" vs "512gb", "1916s" vs "te1916s"), o
// (b) si el título no trae modelo fuerte, comparten al menos 2 tokens de
// contenido significativos.
function titleMatches(prodTitle: string, mlTitle: string): boolean {
  const p = tokens(prodTitle).filter((t) => t.length >= 2 && !STOP.has(t));
  const mAll = tokens(mlTitle).filter((t) => t.length >= 2);
  const models = p.filter((t) => /\d/.test(t) && t.length >= 3);
  if (models.length > 0) {
    return models.some((t) =>
      mAll.some((m) => m === t || (m.length > t.length && m.includes(t)))
    );
  }
  const mKeys = new Set(tokens(mlTitle).filter((t) => t.length >= 3 && !STOP.has(t)));
  let shared = 0;
  for (const t of p) {
    if (/\d/.test(t) || t.length < 3 || STOP.has(t)) continue;
    if (mKeys.has(t)) shared++;
  }
  return shared >= 2;
}

// Precios en ARS marcados con $ o ARS. Excluye cuotas ("12x $7.458",
// "6 cuotas de $39.678"), precios sin impuestos ("Precio sin impuestos
// nacionales: $130.101") y USD.
function extractPrices(text: string): number[] {
  const cleaned = text
    .replace(/\b\d{1,3}x\s*(?:\$|ars)\s*[\d.,]+/gi, ' ')
    .replace(/\b\d{1,3}\s+cuotas?\b[^$]{0,40}\$\s*[\d.,]+/gi, ' ')
    .replace(/sin\s+impuestos[^$]{0,60}\$\s*[\d.,]+/gi, ' ')
    .replace(/\b(?:us\$|u\$d|usd)\s?\d[\d.,]*/gi, ' ');
  const out: number[] = [];
  const patterns = [
    /\$\s?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{4,9}(?:,\d{1,2})?)/gi,
    /\bARS\s?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{4,9}(?:,\d{1,2})?)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned))) {
      const raw = m[1];
      const v = raw.includes(',')
        ? Math.round(parseFloat(raw.replace(/\./g, '').replace(',', '.')))
        : parseInt(raw.replace(/\./g, ''), 10);
      if (v >= 5000 && v <= 20_000_000) out.push(v);
    }
  }
  return out;
}

function pickBest(prod: Producto, hits: RawHit[]): MlPick | null {
  let best: MlPick | null = null;
  for (const h of hits) {
    if (!h.url.includes('mercadolibre.com.ar')) continue;
    if (/click\d\.mercadolibre|\/display\/clicks/.test(h.url)) continue;
    const head = (h.text || '').slice(0, 120);
    const byTitle = titleMatches(prod.title, h.title);
    const byHead = !byTitle && titleMatches(prod.title, `${h.title} ${head}`);
    if (!byTitle && !byHead) continue;
    // El match por snippet (páginas de listado, cuyo snippet mezcla el
    // resultado con otros items) exige una ventana más estrecha.
    const lo = byTitle ? 0.3 : 0.55;
    const hi = byTitle ? 3 : 1.85;
    const prices = extractPrices(`${h.title}\n${(h.text || '').slice(0, 400)}`);
    for (const p of prices) {
      if (p < prod.price * lo || p > prod.price * hi) continue;
      if (!best || p < best.price) best = { ...h, price: p };
    }
  }
  return best;
}

// Query corto y con dígitos: marca + categoría + modelo(s). La categoría se
// toma del título sin filtrar STOP (para "Camara ..." importa "camara" aunque
// sea palabra vacía en el matching), y los títulos completos de campaña traen
// specs que DDG exige todas y devuelve basura.
function buildQuery(p: Producto): string {
  const brandToks = new Set(tokens(p.brand));
  const raw = tokens(p.title).filter((t) => t.length >= 2);
  const rest = raw.filter((t) => !STOP.has(t));
  const strong = rest.filter((t) => /\d/.test(t) && t.length >= 3);
  const weak = rest.filter((t) => /\d/.test(t) && t.length >= 2);
  const models = strong.length ? strong : weak;
  const cat = raw.find((t) => !/\d/.test(t) && t.length >= 3 && !brandToks.has(t));
  const parts: string[] = [];
  for (const t of [norm(p.brand).trim(), cat ?? '', ...models.slice(0, 2)]) {
    if (t && !parts.includes(t)) parts.push(t);
  }
  if (parts.length < 4) {
    for (const t of rest) {
      if (parts.length >= 4) break;
      if (/\d/.test(t) || t.length < 3 || brandToks.has(t) || parts.includes(t)) continue;
      parts.push(t);
    }
  }
  return parts.join(' ');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type DdgBrowser = Awaited<ReturnType<typeof puppeteer.launch>>;
type DdgPage = Awaited<ReturnType<DdgBrowser['newPage']>>;

type DdgSearchResult = { anomaly: boolean; hits: RawHit[] };

async function searchDdg(
  page: DdgPage,
  q: string,
  domain: 'articulo.mercadolibre.com.ar' | 'mercadolibre.com.ar' = 'articulo.mercadolibre.com.ar'
): Promise<RawHit[]> {
  const target = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(
    `site:${domain} ${q}`
  )}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const res = await page.evaluate(async (): Promise<DdgSearchResult> => {
        const deadline = Date.now() + 6000;
        while (Date.now() < deadline) {
          if (
            document.querySelector('a.result__a') ||
            document.querySelector('form[action*="anomaly.js"]')
          )
            break;
          await new Promise((r) => setTimeout(r, 250));
        }
        const anomaly = Boolean(document.querySelector('form[action*="anomaly.js"]'));
        const out: RawHit[] = [];
        if (!anomaly) {
          const boxes = Array.from(document.querySelectorAll('.result')) as HTMLElement[];
          const seen = new Set<string>();
          for (const box of boxes) {
            if (box.classList.contains('result--ad') || box.closest('.result--ad')) continue;
            const a = box.querySelector('a.result__a') as HTMLAnchorElement | null;
            if (!a) continue;
            let href = a.href;
            const m = /[?&]uddg=([^&]+)/.exec(href);
            if (m) {
              try {
                href = decodeURIComponent(m[1]);
              } catch {
                /* queda href original */
              }
            }
            if (!href.includes('mercadolibre.com.ar') || seen.has(href)) continue;
            seen.add(href);
            const snip = box.querySelector('.result__snippet');
            out.push({
              title: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
              url: href,
              text: (snip?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 800),
            });
            if (out.length >= 10) break;
          }
        }
        return { anomaly, hits: out };
      });
      if (!res.anomaly) return res.hits;
      console.log('ddg anomaly, backoff:', q);
      await sleep(8000);
    } catch (e) {
      console.log('ddg nav fallo:', q, String((e as Error)?.message || e).slice(0, 150));
      if (attempt === 1) return [];
    }
  }
  return [];
}

function toItem(section: string, p: Producto, best: MlPick | null): ItemResult {
  let cheaper: ItemResult['cheaper'] = 'no_data';
  let diff: number | null = null;
  if (best && p.price > 0) {
    diff = Math.round(((best.price - p.price) / p.price) * 1000) / 10;
    cheaper = best.price < p.price * 0.99 ? 'ml' : best.price > p.price * 1.01 ? 'us' : 'tie';
  }
  return {
    id: p.id,
    section,
    title: p.title,
    url: p.url,
    our_price: p.price,
    ml_price: best ? best.price : null,
    ml_title: best ? best.title : null,
    ml_url: best ? best.url : null,
    source: best ? 'ddg' : null,
    diff_pct: diff,
    cheaper,
  };
}

async function runCompare(
  env: Env,
  trigger: string,
  limit?: number,
  offset?: number
): Promise<Report> {
  const raw = await env.FLYERS.get('snapshot:latest');
  if (!raw) throw new Error('no hay snapshot:latest en KV');
  const snap = JSON.parse(raw) as Snapshot;

  const flat: { seccion: string; p: Producto }[] = [];
  for (const s of snap.secciones ?? []) {
    for (const p of s.productos ?? []) flat.push({ seccion: s.key, p });
  }
  const off = Math.max(0, offset ?? 0);
  const todo = limit != null ? flat.slice(off, off + limit) : flat.slice(off);

  const startedAt = new Date().toISOString();
  const items: ItemResult[] = [];
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.setUserAgent(CHROME_UA);
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8' });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    let done = 0;
    for (const { seccion, p } of todo) {
      const q = buildQuery(p);
      let hits = await searchDdg(page, q);
      let best = pickBest(p, hits);
      let pass = 1;
      if (!best) {
        await sleep(1200);
        hits = await searchDdg(page, q, 'mercadolibre.com.ar');
        best = pickBest(p, hits);
        pass = 2;
      }
      items.push(toItem(seccion, p, best));
      done++;
      await env.FLYERS.put(
        'ml-compare:status',
        JSON.stringify({
          state: 'running',
          done,
          total: todo.length,
          trigger,
          started_at: startedAt,
          last: { id: p.id, q, pass, hits: hits.length, found: Boolean(best) },
        })
      );
      console.log(
        'contraste item',
        p.id,
        JSON.stringify({ q, pass, hits: hits.length, ml: best?.price ?? null })
      );
      await sleep(700);
    }
    await page.close().catch(() => {});
  } finally {
    await browser.close().catch(() => {});
  }

  const summary = { us: 0, ml: 0, tie: 0, no_data: 0 };
  for (const it of items) summary[it.cheaper]++;

  const report: Report = {
    ran_at: new Date().toISOString(),
    trigger,
    provider: 'ddg',
    snapshot_fecha: snap.fecha,
    total: items.length,
    with_price: items.filter((i) => i.ml_price !== null).length,
    summary,
    items,
  };
  await env.FLYERS.put('ml-compare:latest', JSON.stringify(report));
  await env.FLYERS.put(
    'ml-compare:status',
    JSON.stringify({
      state: 'done',
      total: items.length,
      finished_at: report.ran_at,
      trigger,
      with_price: report.with_price,
      summary,
      sample: items.slice(0, 5).map((i) => ({ id: i.id, ml: i.ml_price })),
    })
  );
  return report;
}

const fmt = (n: number) => '$' + n.toLocaleString('es-AR');

function htmlReport(r: Report): string {
  const rows = r.items
    .map((i) => {
      const diff =
        i.diff_pct === null
          ? '—'
          : `${i.diff_pct > 0 ? '+' : ''}${i.diff_pct.toFixed(1)}%`;
      const color =
        i.cheaper === 'ml' ? '#b91c1c' : i.cheaper === 'us' ? '#15803d' : i.cheaper === 'tie' ? '#a16207' : '#6b7280';
      const quien =
        i.cheaper === 'ml' ? 'ML más barato' : i.cheaper === 'us' ? 'Nosotros' : i.cheaper === 'tie' ? 'Empate' : 'Sin dato';
      return `<tr>
<td>${i.section}</td>
<td><a href="${i.url}" target="_blank" rel="noopener">${i.title}</a></td>
<td class="num">${fmt(i.our_price)}</td>
<td class="num">${i.ml_price !== null ? fmt(i.ml_price) : '—'}</td>
<td class="num" style="color:${color};font-weight:600">${diff}</td>
<td style="color:${color}">${quien}</td>
<td>${i.ml_url ? `<a href="${i.ml_url}" target="_blank" rel="noopener">ver en ML</a>` : '—'}</td>
</tr>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Contraste precios vs MercadoLibre — Lanus Computacion</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:2rem auto;max-width:1200px;padding:0 1rem;color:#111}
h1{font-size:1.4rem} .meta{color:#6b7280;font-size:.9rem;margin-bottom:1rem}
.chips{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}
.chip{background:#f3f4f6;border-radius:999px;padding:.25rem .75rem;font-size:.85rem}
table{border-collapse:collapse;width:100%;font-size:.9rem}
th,td{padding:.5rem .6rem;border-bottom:1px solid #e5e7eb;text-align:left;vertical-align:top}
th{background:#f9fafb;position:sticky;top:0}
td.num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
a{color:#2563eb;text-decoration:none} a:hover{text-decoration:underline}
</style></head><body>
<h1>Precios de campaña vs MercadoLibre</h1>
<div class="meta">Snapshot ${r.snapshot_fecha} · corrido ${r.ran_at} (${r.trigger}) · proveedor ${r.provider} · ${r.with_price}/${r.total} con precio de ML</div>
<div class="chips">
<span class="chip">Nosotros más baratos: ${r.summary.us}</span>
<span class="chip">ML más barato: ${r.summary.ml}</span>
<span class="chip">Empates: ${r.summary.tie}</span>
<span class="chip">Sin dato: ${r.summary.no_data}</span>
</div>
<table><thead><tr><th>Sección</th><th>Producto</th><th style="text-align:right">Nuestro</th><th style="text-align:right">Mejor ML</th><th style="text-align:right">Δ%</th><th>Quién</th><th>Publicación</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}

function csvReport(r: Report): string {
  const esc = (s: string) => '"' + String(s).replace(/"/g, '""') + '"';
  const head = ['seccion', 'producto', 'precio_nuestro', 'precio_ml', 'diff_pct', 'quien', 'url_producto', 'url_ml'];
  const lines = r.items.map((i) =>
    [
      i.section,
      i.title,
      String(i.our_price),
      i.ml_price !== null ? String(i.ml_price) : '',
      i.diff_pct !== null ? String(i.diff_pct) : '',
      i.cheaper,
      i.url,
      i.ml_url ?? '',
    ]
      .map(esc)
      .join(',')
  );
  return '\ufeff' + [head.join(','), ...lines].join('\r\n');
}

function json(res: unknown, status = 200): Response {
  return new Response(JSON.stringify(res, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default {
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    try {
      const report = await runCompare(env, 'cron');
      console.log('contraste ok:', JSON.stringify({ total: report.total, ...report.summary }));
    } catch (e) {
      console.error('contraste fallo:', String((e as Error)?.message || e));
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/refresh') {
      if (!env.REFRESH_SECRET) return json({ ok: false, error: 'REFRESH_SECRET no configurado' }, 503);
      if (request.headers.get('x-refresh-secret') !== env.REFRESH_SECRET)
        return json({ ok: false, error: 'secret invalido' }, 403);
      const statusRaw = await env.FLYERS.get('ml-compare:status');
      if (statusRaw) {
        try {
          const st = JSON.parse(statusRaw);
          if (st.state === 'running' && Date.now() - Date.parse(st.started_at) < 14 * 60_000)
            return json({ ok: false, error: 'ya hay un contraste en curso' }, 409);
        } catch {
          /* status corrupto: seguir */
        }
      }
      const limitParam = url.searchParams.get('limit');
      const offsetParam = url.searchParams.get('offset');
      const limit = limitParam != null ? Math.max(1, parseInt(limitParam, 10) || 0) : undefined;
      const offset = offsetParam != null ? Math.max(0, parseInt(offsetParam, 10) || 0) : undefined;
      await env.FLYERS.put(
        'ml-compare:status',
        JSON.stringify({ state: 'running', done: 0, total: 0, trigger: 'manual', started_at: new Date().toISOString() })
      );
      try {
        const report = await runCompare(env, 'manual', limit, offset);
        return json({
          ok: true,
          ran_at: report.ran_at,
          provider: report.provider,
          snapshot_fecha: report.snapshot_fecha,
          total: report.total,
          with_price: report.with_price,
          summary: report.summary,
        });
      } catch (e) {
        const error = String((e as Error)?.message || e);
        await env.FLYERS.put(
          'ml-compare:status',
          JSON.stringify({ state: 'error', error, finished_at: new Date().toISOString() })
        );
        return json({ ok: false, error }, 500);
      }
    }

    if (path === '/status') {
      const raw = await env.FLYERS.get('ml-compare:status');
      return json(raw ? JSON.parse(raw) : { state: 'nunca' });
    }

    if (path === '/' || path === '/info') {
      const raw = await env.FLYERS.get('ml-compare:latest');
      let last: unknown = null;
      if (raw) {
        const r = JSON.parse(raw) as Report;
        last = {
          ran_at: r.ran_at,
          trigger: r.trigger,
          provider: r.provider,
          snapshot_fecha: r.snapshot_fecha,
          total: r.total,
          with_price: r.with_price,
          summary: r.summary,
        };
      }
      return json({
        name: 'lanus-ml-compare',
        provider: 'ddg (scraping via Browser Run)',
        refresh_enabled: Boolean(env.REFRESH_SECRET),
        last_report: last,
        endpoints: ['/info', '/report.html', '/report.json', '/report.csv', '/status', '/refresh (x-refresh-secret)', '/test-ddg-web'],
      });
    }

    if (path === '/report' || path === '/report.html' || path === '/report.json' || path === '/report.csv') {
      const raw = await env.FLYERS.get('ml-compare:latest');
      if (!raw) return json({ ok: false, error: 'sin informe: correr /refresh' }, 404);
      const report = JSON.parse(raw) as Report;
      if (path.endsWith('.json')) return json(report);
      if (path.endsWith('.csv'))
        return new Response(csvReport(report), {
          headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="contraste-ml.csv"' },
        });
      return new Response(htmlReport(report), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    if (path === '/test-ddg-web') {
      const q = url.searchParams.get('q') || 'router cudy ax1500';
      const mode = url.searchParams.get('mode') || 'html';
      const domain = url.searchParams.get('domain') || 'articulo.mercadolibre.com.ar';
      const query = `site:${domain} ${q}`;
      const started = Date.now();
      try {
        const browser = await puppeteer.launch(env.BROWSER);
        const page = await browser.newPage();
        await page.setUserAgent(CHROME_UA);
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8' });
        await page.evaluateOnNewDocument(() => {
          Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });
        const target =
          mode === 'html'
            ? `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
            : `https://duckduckgo.com/?q=${encodeURIComponent(query)}&ia=web&kl=ar-es`;
        let navError: string | null = null;
        try {
          await page.goto(target, { waitUntil: 'networkidle2', timeout: 40000 });
        } catch (e) {
          navError = String((e as Error)?.message || e).slice(0, 180);
        }
        await sleep(3000);
        const info = await page.evaluate(() => ({
          url: location.href,
          title: document.title,
          bodyPrices: (document.body?.innerText.match(/\$\s?[\d\.]{4,}/g) || []).slice(0, 10),
          anomaly: Boolean(document.querySelector('form[action*="anomaly.js"]')),
          resultCount: document.querySelectorAll('article[data-testid="result"], a.result__a').length,
          bodyHead: (document.body?.innerText || '').slice(0, 500),
        }));
        let items: RawHit[] = [];
        if (mode === 'html') {
          items = await page.evaluate(() => {
            const out: RawHit[] = [];
            const boxes = Array.from(document.querySelectorAll('.result')) as HTMLElement[];
            for (const box of boxes) {
              const a = box.querySelector('a.result__a') as HTMLAnchorElement | null;
              if (!a) continue;
              let href = a.href;
              const m = /[?&]uddg=([^&]+)/.exec(href);
              if (m) {
                try {
                  href = decodeURIComponent(m[1]);
                } catch {
                  /* keep */
                }
              }
              const snip = box.querySelector('.result__snippet');
              out.push({
                title: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200),
                url: href,
                text: (snip?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 600),
              });
              if (out.length >= 10) break;
            }
            return out;
          });
        } else {
          items = await page.evaluate(() => {
            const out: RawHit[] = [];
            const blocks = Array.from(document.querySelectorAll('article[data-testid="result"]'));
            for (const b of blocks) {
              const a = b.querySelector(
                'a[href*="uddg="], a[data-testid="result-title-a"]'
              ) as HTMLAnchorElement | null;
              if (!a) continue;
              let href = a.href;
              const m = /[?&]uddg=([^&]+)/.exec(href);
              if (m) {
                try {
                  href = decodeURIComponent(m[1]);
                } catch {
                  /* keep */
                }
              }
              out.push({
                title: (a.innerText || '').trim().slice(0, 160),
                url: href,
                text: ((b as HTMLElement).innerText || '').replace(/\s+/g, ' ').slice(0, 600),
              });
              if (out.length >= 10) break;
            }
            return out;
          });
        }
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
        return json({ ok: true, mode, elapsedMs: Date.now() - started, navError, info, items });
      } catch (e) {
        return json(
          { ok: false, error: String((e as Error)?.message || e), elapsedMs: Date.now() - started },
          500
        );
      }
    }

    return new Response('lanus-ml-compare', { status: 200 });
  },
};
