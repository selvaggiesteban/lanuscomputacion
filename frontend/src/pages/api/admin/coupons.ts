import type { APIRoute } from 'astro';
import { getAllCoupons, upsertCoupon, deleteCoupon } from '../../../lib/d1';
import { requireAdmin, unauthorized } from '../../../lib/admin-auth';

export const GET: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  const coupons = await getAllCoupons(auth.DB);
  return new Response(JSON.stringify(coupons), { headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  const body = await request.json();
  const { id, code, type, value, min_purchase, max_uses, applies_to, target_id, start_date, end_date, is_active } = body;

  if (!id || !code || !type || value === undefined) {
    return new Response(JSON.stringify({ error: 'Campos obligatorios faltantes' }), { status: 400 });
  }

  try {
    await upsertCoupon(auth.DB, {
      id, code: code.toUpperCase(), type, value,
      min_purchase, max_uses, applies_to, target_id,
      start_date, end_date,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : 1,
    });
  } catch (e) {
    console.error('D1 Error in frontend/src/pages/api/admin/coupons.ts:', e);
    return new Response(JSON.stringify({ error: 'Error al guardar el cupón' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }));
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  try {
    await deleteCoupon(auth.DB, id);
  } catch (e) {
    console.error('D1 Error in frontend/src/pages/api/admin/coupons.ts:', e);
    return new Response(JSON.stringify({ error: 'Error al eliminar el cupón' }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }));
};
