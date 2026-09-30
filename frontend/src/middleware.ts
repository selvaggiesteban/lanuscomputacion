import { defineMiddleware } from 'astro:middleware';
import { verifyToken, getJwtSecret } from './lib/auth';

// ── Edge cache for public catalog pages (D1 quota protection) ──────────────
// Rendered HTML is stored at the Cloudflare edge via the Cache API so repeat
// visits and crawlers never execute D1 queries (free tier: 5M rows_read/day).
// Never cached: /admin*, /api*, /p/* (NFC writes a scan row per visit),
// account/cart/checkout pages, non-200 responses and Set-Cookie responses.
const CACHE_RULES: { test: RegExp; sMaxAge: number }[] = [
  { test: /^\/$/, sMaxAge: 300 }, // home
  { test: /^\/ofertas$/, sMaxAge: 300 },
  { test: /^\/categoria\/[^/]+$/, sMaxAge: 300 },
  { test: /^\/producto\/[^/]+$/, sMaxAge: 300 },
  { test: /^\/busqueda\/[^/]+$/, sMaxAge: 120 },
  { test: /^\/servicios(\/[^/]+)?$/, sMaxAge: 3600 },
  {
    test: /^\/(como-comprar|contacto|preguntas-frecuentes|politicas-de-privacidad|politicas-de-cookies|politica-de-devoluciones|b2b)$/,
    sMaxAge: 3600,
  },
  { test: /^\/sitemap\.xml$/, sMaxAge: 3600 },
];

// Long-lived backup copy: served only when the origin render fails (e.g. D1
// quota exhausted), so visitors still see the last good version of the page.
const STALE_TTL = 604800; // 7 days

function matchCacheRule(pathname: string) {
  for (const rule of CACHE_RULES) {
    if (rule.test.test(pathname)) return rule;
  }
  return null;
}

function staleKeyFor(url: URL) {
  return new Request(new URL(`/__stale${url.pathname}${url.search}`, url));
}

function unavailableResponse(pathname: string, retryAfter = '300'): Response {
  if (pathname.startsWith('/api/')) {
    return new Response(
      JSON.stringify({
        error: 'Servicio temporalmente no disponible. Intentá de nuevo en unos minutos.',
      }),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': retryAfter,
        },
      }
    );
  }

  const html = `<!DOCTYPE html>
<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta http-equiv="refresh" content="30">
<title>Lanus Computación — Sitio no disponible</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#0f172a;color:#e2e8f0;font-family:system-ui,-apple-system,sans-serif}
  .card{max-width:26rem;padding:2rem;text-align:center}
  h1{font-size:1.25rem;margin:0 0 .75rem}
  p{color:#94a3b8;line-height:1.6;margin:0 0 1.25rem}
  .dot{display:inline-block;width:.5rem;height:.5rem;border-radius:50%;background:#f59e0b;
       margin-right:.5rem;animation:p 1.2s infinite}
  @keyframes p{50%{opacity:.3}}
  small{color:#64748b}
</style>
</head>
<body>
<main class="card">
  <h1><span class="dot"></span>Estamos teniendo un problema temporal</h1>
  <p>El sitio se está restaurando. Esta página se actualizará automáticamente en unos segundos.</p>
  <small>Si persiste, escribinos a info@lanuscomputacion.com</small>
</main>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': retryAfter,
      'Cache-Control': 'no-store',
    },
  });
}

// Protect admin routes + serve public pages from the edge cache
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  // Only protect /admin routes
  let isAdmin = false;
  if (pathname.startsWith('/admin')) {
    const cookie = context.request.headers.get('Cookie') || '';
    const match = cookie.match(/session_token=([^;]+)/);

    if (!match) {
      return context.redirect('/login');
    }

    const jwtSecret = getJwtSecret(context.locals.runtime?.env || {});
    if (!jwtSecret) {
      return context.redirect('/login');
    }

    const payload = await verifyToken(match[1], jwtSecret);
    if (!payload || !payload.isAdmin) {
      return context.redirect('/login');
    }

    // Add user to context
    context.locals.adminUser = payload;
    isAdmin = true;
  }

  const rule =
    !isAdmin && context.request.method === 'GET' ? matchCacheRule(pathname) : null;
  const runtime = context.locals.runtime as any;
  const cache = runtime?.caches?.default ?? (globalThis as any).caches?.default;

  // 1) Edge cache HIT → respond without running Astro (0 D1 rows read)
  if (rule && cache) {
    try {
      const hit = await cache.match(context.request);
      if (hit) {
        const headers = new Headers(hit.headers);
        headers.set('X-Cache', 'HIT');
        return new Response(hit.body, {
          status: hit.status,
          headers,
        });
      }
    } catch {
      // Cache unavailable → fall through to origin
    }
  }

  // 2) Render the page. On failure (e.g. D1 quota exhausted) serve the last
  //    good edge copy if we have one, otherwise a friendly 503 — never leak
  //    stack traces or return an empty body.
  let response: Response;
  try {
    response = await next();
  } catch (err: any) {
    console.error(`[render] ${context.request.method} ${pathname} failed:`, err?.message || err);

    if (rule && cache) {
      try {
        const stale = await cache.match(staleKeyFor(new URL(context.request.url)));
        if (stale) {
          const headers = new Headers(stale.headers);
          headers.set('X-Cache', 'STALE');
          headers.set('Cache-Control', 'no-store');
          return new Response(stale.body, { status: 200, headers });
        }
      } catch {
        // Stale copy unavailable → friendly fallback below
      }
    }

    return unavailableResponse(pathname);
  }

  // 3) MISS → store public 200 HTML at the edge (max-age for browsers,
  //    s-maxage for the edge cache; never cache Set-Cookie responses),
  //    plus a long-lived stale backup for origin-failure fallbacks.
  if (rule && cache && response.status === 200 && !response.headers.get('Set-Cookie')) {
    try {
      const headers = new Headers(response.headers);
      headers.set(
        'Cache-Control',
        `public, s-maxage=${rule.sMaxAge}, max-age=${Math.min(60, rule.sMaxAge)}`
      );
      headers.set('X-Cache', 'MISS');
      const outgoing = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      const putPrimary = cache.put(context.request, outgoing.clone());

      const staleHeaders = new Headers(headers);
      staleHeaders.set('Cache-Control', `public, s-maxage=${STALE_TTL}, max-age=0`);
      const putStale = cache.put(
        staleKeyFor(new URL(context.request.url)),
        new Response(outgoing.clone().body, {
          status: outgoing.status,
          statusText: outgoing.statusText,
          headers: staleHeaders,
        })
      );

      const puts = Promise.allSettled([putPrimary, putStale]);
      if (typeof runtime?.ctx?.waitUntil === 'function') {
        runtime.ctx.waitUntil(puts);
      } else {
        await puts;
      }
      return outgoing;
    } catch {
      return response;
    }
  }

  return response;
});
