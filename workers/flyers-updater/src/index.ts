// lanus-flyers-updater — Worker con cron (7:00 y 17:00 ART).
// Refresca el snapshot de precios de los flyers de campaña en KV
// (clave `snapshot:latest`, binding FLYERS), sirvido por el sitio en
// /lista/{año}/ofertas-lanus-{fecha}-{día}.html.
//
// Replica completo el pipeline de selección de la campaña
// (datos/fetch-productos.mjs): las 7 secciones de la plantilla con todas
// sus queries, los filtros de stock/precio/miniatura, el dedupe por id,
// el orden por stock y las mismas cantidades por sección
// (NAS 5, NOTEBOOKS 8, PCs 3, MONITORES 4, REDES 8, UPS 3, DISCOS 3 = 34).

export interface Env {
  DB: D1Database;
  FLYERS: KVNamespace;
  UPDATE_SECRET?: string;
}

// Reglas B2B leídas de la tabla b2b_rules (is_active=1) — igual que lib/b2b.ts
type B2bRuleMap = {
  map: Record<string, { disc: number; min: number }>;
  def: { disc: number; min: number };
};

async function loadB2bRules(db: D1Database): Promise<B2bRuleMap> {
  const { results } = await db
    .prepare(
      "SELECT category_name, discount_pct, min_quantity FROM b2b_rules WHERE is_active = 1"
    )
    .all<{ category_name: string; discount_pct: number; min_quantity: number }>();
  const map: Record<string, { disc: number; min: number }> = {};
  const def = { disc: 0.15, min: 6 };
  for (const r of results ?? []) {
    const key = (r.category_name || '').trim().toLowerCase();
    const entry = { disc: Number(r.discount_pct) || 0, min: Number(r.min_quantity) || 1 };
    if (key === 'default') {
      def.disc = entry.disc;
      def.min = entry.min;
    } else {
      map[key] = entry;
    }
  }
  return { map, def };
}

function b2bFor(rules: B2bRuleMap, categoryName: string) {
  const key = (categoryName || '').trim().toLowerCase();
  return rules.map[key] || rules.def;
}

type ProductRow = {
  id: string;
  title: string;
  brand: string | null;
  category_name: string | null;
  price: number;
  available_qty: number;
  thumbnail: string | null;
  slug: string;
  iva_pct: number | null;
  internal_tax_pct: number | null;
};

// Réplica de /api/search (frontend/src/pages/api/search.ts):
// status='published' AND (title LIKE ? OR brand LIKE ? OR ean LIKE ? OR sku LIKE ?)
// ORDER BY available_qty DESC, title ASC LIMIT 50
async function search(db: D1Database, q: string, limit = 50): Promise<ProductRow[]> {
  const term = `%${q}%`;
  const { results } = await db
    .prepare(
      "SELECT * FROM products WHERE status = 'published' AND (title LIKE ? OR brand LIKE ? OR ean LIKE ? OR sku LIKE ?) ORDER BY available_qty DESC, title ASC LIMIT ?"
    )
    .bind(term, term, term, term, limit)
    .all<ProductRow>();
  return results ?? [];
}

type SectionDef = {
  key: string;
  title: string;
  desc: string;
  queries: string[];
  count: number;
  categoryAny?: string[];
  categoryIs?: string;
};

// Secciones de la campaña vigente (flyer viernes): cámaras de seguridad,
// monitores, notebooks, PCs de escritorio, discos y redes.
const SECTIONS: SectionDef[] = [
  { key: 'camaras', title: 'CÁMARAS DE SEGURIDAD', desc: 'Cámaras IP, WiFi y accesorios para vigilar tu casa o tu negocio.', queries: [], count: 5, categoryIs: 'Seguridad' },
  { key: 'monitores', title: 'MONITORES', desc: 'Pantallas para oficina, gaming y home office.', queries: ['monitor'], count: 4, categoryAny: ['imagen'] },
  { key: 'notebooks', title: 'NOTEBOOKS', desc: 'Equipos para trabajar y estudiar, con stock inmediato.', queries: ['notebook'], count: 8, categoryAny: ['computadoras'] },
  { key: 'pcs', title: 'PCs DE ESCRITORIO', desc: 'Computadoras de escritorio y mini PCs listas para usar.', queries: ['mini pc', 'computadora de escritorio', 'pc de escritorio', 'computadora'], count: 3 },
  { key: 'discos', title: 'DISCOS', desc: 'SSD y discos rígidos para ampliar tu almacenamiento.', queries: ['ssd', 'disco'], count: 3 },
  { key: 'redes', title: 'REDES', desc: 'Routers, switches y equipamiento para armar tu red.', queries: ['router', 'switch', 'mikrotik', 'tp-link', 'wifi', 'antena', 'access point', 'modem', 'huawei', 'd-link', 'repetidor'], count: 8, categoryAny: ['conectividad', 'cables'] },
];

async function updateSnapshot(env: Env) {
  const seenIds = new Set<string>();
  const secciones = [];
  const b2b = await loadB2bRules(env.DB);

  for (const section of SECTIONS) {
    let candidates: ProductRow[] = [];
    if (section.categoryIs) {
      const { results } = await env.DB
        .prepare(
          "SELECT * FROM products WHERE status = 'published' AND category_name = ? ORDER BY available_qty DESC, title ASC LIMIT 100"
        )
        .bind(section.categoryIs)
        .all<ProductRow>();
      candidates = results ?? [];
    } else {
      for (const q of section.queries) {
        candidates = candidates.concat(await search(env.DB, q));
      }
    }
    const byId = new Map<string, ProductRow>();
    for (const p of candidates) {
      if (!p || seenIds.has(p.id)) continue;
      if (!(p.available_qty > 0) || !(p.price > 0)) continue;
      if (!p.thumbnail || !p.thumbnail.startsWith('http')) continue;
      if (section.categoryAny) {
        const cat = (p.category_name || '').trim().toLowerCase();
        if (!section.categoryAny.includes(cat)) continue;
      }
      if (!byId.has(p.id)) byId.set(p.id, p);
    }
    const productos = [...byId.values()]
      .sort((a, b) => b.available_qty - a.available_qty)
      .slice(0, section.count)
      .map((p) => {
        const rule = b2bFor(b2b, p.category_name || '');
        return {
          id: p.id,
          title: p.title,
          brand: p.brand || '',
          category_name: p.category_name || '',
          price: p.price,
          mayorista: Math.round(p.price * (1 - rule.disc)),
          descuento_pct: rule.disc,
          min_qty: rule.min,
          iva_pct: typeof p.iva_pct === 'number' ? p.iva_pct : 21,
          internal_tax_pct: typeof p.internal_tax_pct === 'number' ? p.internal_tax_pct : 0,
          thumbnail: p.thumbnail,
          slug: p.slug,
          stock: p.available_qty,
          url: `https://lanuscomputacion.com/producto/${p.slug}`,
        };
      });
    for (const p of productos) seenIds.add(p.id);
    secciones.push({ key: section.key, title: section.title, desc: section.desc, productos });
  }

  const fecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date());

  const snapshot = { fecha, fuente: 'd1:lanus-catalog', secciones };
  await env.FLYERS.put('snapshot:latest', JSON.stringify(snapshot));

  const counts: Record<string, number> = {};
  let total = 0;
  for (const s of secciones) {
    counts[s.key] = s.productos.length;
    total += s.productos.length;
  }
  return { fecha, counts, total };
}

export default {
  async scheduled(_event: ScheduledController, env: Env): Promise<void> {
    const result = await updateSnapshot(env);
    console.log('snapshot actualizado:', JSON.stringify(result));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (
      url.pathname === '/update' &&
      env.UPDATE_SECRET &&
      request.headers.get('x-update-secret') === env.UPDATE_SECRET
    ) {
      try {
        const result = await updateSnapshot(env);
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    return new Response('lanus-flyers-updater', { status: 200 });
  },
};
