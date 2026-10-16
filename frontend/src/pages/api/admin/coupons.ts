import type { APIRoute } from 'astro';
import { getAllCoupons, upsertCoupon, deleteCoupon } from '../../../lib/d1';

export const GET: APIRoute = async ({ locals }) => {
  const { env } = locals as { env: { DB: D1Database } };
  const coupons = await getAllCoupons(env.DB);
  return new Response(JSON.stringify(coupons));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const { env } = locals as { env: { DB: D1Database } };
  const body = await request.json();
  const { id, code, type, value, min_purchase, max_uses, applies_to, target_id, start_date, end_date, is_active } = body;

  if (!id || !code || !type || value === undefined) {
    return new Response(JSON.stringify({ error: 'Campos obligatorios faltantes' }), { status: 400 });
  }

  await upsertCoupon(env.DB, {
    id, code: code.toUpperCase(), type, value,
    min_purchase, max_uses, applies_to, target_id,
    start_date, end_date, is_active,
  });

  return new Response(JSON.stringify({ ok: true }));
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const { env } = locals as { env: { DB: D1Database } };
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  await deleteCoupon(env.DB, id);
  return new Response(JSON.stringify({ ok: true }));
};
