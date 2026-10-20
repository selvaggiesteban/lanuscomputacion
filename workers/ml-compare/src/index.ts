// lanus-ml-compare — Worker con cron diario (13:00 UTC / 10:00 ART) que
// contrasta los precios de los productos de la campaña (KV `snapshot:latest`,
// la misma que alimenta /ofertas y /lista/) contra publicaciones reales de
// MercadoLibre Argentina. Guarda el informe en KV `ml-compare:latest`.
//
// Proveedor de datos (auto): API oficial de MLA con ML_ACCESS_TOKEN si existe;
// si no, Exa Search (EXA_API_KEY) restringido a mercadolibre.com.ar.
// ML bloquea el scraping directo (bot detection) y su API sin token (403),
// por eso se busca por título y se parsean precios de las publicaciones.
//
// Endpoints:
//   GET|POST /refresh  (header x-refresh-secret = REFRESH_SECRET) → corre el contraste
//   GET /report.html   informe HTML (default /report)
//   GET /report.json   informe JSON
//   GET /report.csv    informe CSV
//   GET /status        progreso del último refresh
//   GET /info          estado del worker (proveedor configurado, último informe)

export interface Env {
  FLYERS: KVNamespace;
  ML_ACCESS_TOKEN?: string;
  EXA_API_KEY?: string;
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
  directPrice?: number;
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
  source: 'ml-api' | 'exa' | null;
  diff_pct: number | null;
  cheaper: 'us' | 'ml' | 'tie' | 'no_data';
};

type Report = {
  ran_at: string;
  trigger: string;
  provider: 'ml-api' | 'exa';
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

function norm(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function tokens(s: string): string[] {
  return norm(s).split(/[^a-z0-9]+/).filter(Boolean);
}

// El candidato de ML pasa si: (a) contiene algún token "modelo" de nuestro
// título (con dígito: te1916s, h8c, wr1200e, ax1500...), o (b) comparten
// al menos 2 tokens de contenido significativos.
function titleMatches(prodTitle: string, mlTitle: string): boolean {
  const p = tokens(prodTitle).filter((t) => t.length >= 2 && !STOP.has(t));
  const mAll = new Set(tokens(mlTitle).filter((t) => t.length >= 2));
  const models = p.filter((t) => /\d/.test(t));
  if (models.some((t) => mAll.has(t))) return true;
  const mKeys = new Set(tokens(mlTitle).filter((t) => t.length >= 3 && !STOP.has(t)));
  let shared = 0;
  for (const t of p) {
    if (/\d/.test(t) || t.length < 3 || STOP.has(t)) continue;
    if (mKeys.has(t)) shared++;
  }
  return shared >= 2;
}

// Precios en ARS marcados con $ o ARS, sin cuotas ("12x $7.458") ni USD.
function extractPrices(text: string): number[] {
  const cleaned = text
    .replace(/\b\d{1,3}x\s*(?:\$|ars)\s*[\d.,]+/gi, ' ')
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
    if (!titleMatches(prod.title, h.title)) continue;
    const prices =
      typeof h.directPrice === 'number' && h.directPrice > 0
        ? [h.directPrice]
        : extractPrices(`${h.title}\n${(h.text || '').slice(0, 2500)}`);
    for (const p of prices) {
      if (p < prod.price * 0.3 || p > prod.price * 3) continue;
      if (!best || p < best.price) best = { ...h, price: p };
    }
  }
  return best;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function searchMlApi(env: Env, q: string): Promise<RawHit[]> {
  const url =
    `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(q)}` +
    `&limit=10&sort=price_asc&condition=new`;
  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.ML_ACCESS_TOKEN}` },
  });
  if (res.status === 429) {
    await sleep(1500);
    res = await fetch(url, { headers: { Authorization: `Bearer ${env.ML_ACCESS_TOKEN}` } });
  }
  if (!res.ok) throw new Error(`ml-api HTTP ${res.status}`);
  const data = (await res.json()) as any;
  return (data.results ?? []).map((r: any) => ({
    title: String(r.title ?? ''),
    url: String(r.permalink ?? ''),
    text: '',
    directPrice: r.currency_id === 'ARS' ? Number(r.price) || undefined : undefined,
  }));
}

async function searchExa(env: Env, q: string): Promise<RawHit[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'x-api-key': env.EXA_API_KEY as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: q,
        type: 'auto',
        numResults: 8,
        includeDomains: ['mercadolibre.com.ar'],
        contents: { text: { maxCharacters: 2500, verbosity: 'compact' } },
      }),
    });
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`exa HTTP ${res.status}`);
    const data = (await res.json()) as any;
    return (data.results ?? []).map((r: any) => ({
      title: String(r.title ?? ''),
      url: String(r.url ?? ''),
      text: typeof r.text === 'string' ? r.text : '',
    }));
  }
  throw new Error('exa: 429 tras reintentos');
}

function toItem(
  section: string,
  p: Producto,
  best: MlPick | null,
  source: 'ml-api' | 'exa'
): ItemResult {
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
    source: best ? source : null,
    diff_pct: diff,
    cheaper,
  };
}

async function runCompare(env: Env, trigger: string): Promise<Report> {
  const raw = await env.FLYERS.get('snapshot:latest');
  if (!raw) throw new Error('no hay snapshot:latest en KV');
  const snap = JSON.parse(raw) as Snapshot;
  const provider: Report['provider'] | null = env.ML_ACCESS_TOKEN
    ? 'ml-api'
    : env.EXA_API_KEY
      ? 'exa'
      : null;
  if (!provider) throw new Error('sin proveedor: configurar EXA_API_KEY (o ML_ACCESS_TOKEN)');

  const flat: { seccion: string; p: Producto }[] = [];
  for (const s of snap.secciones ?? []) {
    for (const p of s.productos ?? []) flat.push({ seccion: s.key, p });
  }

  const CONCURRENCY = 3;
  const items: ItemResult[] = [];
  for (let i = 0; i < flat.length; i += CONCURRENCY) {
    const batch = flat.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async ({ seccion, p }) => {
        const q = `${p.brand ? p.brand + ' ' : ''}${p.title}`.slice(0, 150);
        let hits: RawHit[] = [];
        try {
          hits = provider === 'ml-api' ? await searchMlApi(env, q) : await searchExa(env, q);
        } catch (e) {
          console.error('busqueda fallo', p.id, String((e as Error)?.message || e));
        }
        return toItem(seccion, p, pickBest(p, hits), provider);
      })
    );
    items.push(...results);
    await env.FLYERS.put(
      'ml-compare:status',
      JSON.stringify({
        state: 'running',
        done: Math.min(i + CONCURRENCY, flat.length),
        total: flat.length,
        trigger,
        started_at: new Date().toISOString(),
      })
    );
  }

  const summary = { us: 0, ml: 0, tie: 0, no_data: 0 };
  for (const it of items) summary[it.cheaper]++;

  const report: Report = {
    ran_at: new Date().toISOString(),
    trigger,
    provider,
    snapshot_fecha: snap.fecha,
    total: items.length,
    with_price: items.filter((i) => i.ml_price !== null).length,
    summary,
    items,
  };
  await env.FLYERS.put('ml-compare:latest', JSON.stringify(report));
  await env.FLYERS.put(
    'ml-compare:status',
    JSON.stringify({ state: 'done', total: items.length, finished_at: report.ran_at, trigger })
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
          if (st.state === 'running' && Date.now() - Date.parse(st.started_at) < 9 * 60_000)
            return json({ ok: false, error: 'ya hay un contraste en curso' }, 409);
        } catch {
          /* status corrupto: seguir */
        }
      }
      await env.FLYERS.put(
        'ml-compare:status',
        JSON.stringify({ state: 'running', done: 0, total: 0, trigger: 'manual', started_at: new Date().toISOString() })
      );
      try {
        const report = await runCompare(env, 'manual');
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
        return json({ ok: false, error }, /sin proveedor/.test(error) ? 503 : 500);
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
        provider: env.ML_ACCESS_TOKEN ? 'ml-api' : env.EXA_API_KEY ? 'exa' : null,
        configured: Boolean(env.ML_ACCESS_TOKEN || env.EXA_API_KEY),
        refresh_enabled: Boolean(env.REFRESH_SECRET),
        last_report: last,
        endpoints: ['/info', '/report.html', '/report.json', '/report.csv', '/status', '/refresh (x-refresh-secret)'],
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

    return new Response('lanus-ml-compare', { status: 200 });
  },
};
