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

function matchCacheRule(pathname: string) {
  for (const rule of CACHE_RULES) {
    if (rule.test.test(pathname)) return rule;
  }
  return null;
}

// Protect admin routes + serve public pages from the edge cache
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  // Only protect /admin routes
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
    return next();
  }

  const rule =
    context.request.method === 'GET' ? matchCacheRule(pathname) : null;
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

  let response: Response;
  try {
    response = await next();
  } catch (err: any) {
    // TEMP DIAGNOSTIC: surface the render error instead of an empty 500
    return new Response(
      `RENDER_ERROR: ${err?.message || err}\n${err?.stack || ''}`,
      { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Render-Error': '1' } }
    );
  }

  // 2) MISS → store public 200 HTML at the edge (max-age for browsers,
  //    s-maxage for the edge cache; never cache Set-Cookie responses)
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
      const putPromise = cache.put(context.request, outgoing.clone());
      if (typeof runtime?.ctx?.waitUntil === 'function') {
        runtime.ctx.waitUntil(putPromise);
      } else {
        await putPromise;
      }
      return outgoing;
    } catch {
      return response;
    }
  }

  return response;
});
