import { defineMiddleware } from 'astro:middleware';
import { verifyToken } from '../lib/auth';

// Protect admin routes
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  // Only protect /admin routes
  if (pathname.startsWith('/admin')) {
    const cookie = context.request.headers.get('Cookie') || '';
    const match = cookie.match(/session_token=([^;]+)/);

    if (!match) {
      return context.redirect('/login');
    }

    const jwtSecret = context.locals.runtime?.env?.JWT_SECRET;
    if (!jwtSecret) {
      return context.redirect('/login');
    }

    const payload = await verifyToken(match[1], jwtSecret);
    if (!payload || !payload.isAdmin) {
      return context.redirect('/login');
    }

    // Add user to context
    context.locals.adminUser = payload;
  }

  return next();
});
