import type { APIRoute } from 'astro';
import { getB2bRules, upsertB2bRule, deleteB2bRule } from '../../../lib/d1';
import { requireAdmin, unauthorized } from '../../../lib/admin-auth';

export const GET: APIRoute = async ({ locals, request }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  const rules = await getB2bRules(auth.DB);
  return new Response(JSON.stringify(rules), { headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  const body = await request.json();
  const { id, category_name, discount_pct, min_quantity, is_active } = body;

  if (!id || !category_name || discount_pct === undefined || min_quantity === undefined) {
    return new Response(JSON.stringify({ error: 'Campos obligatorios faltantes' }), { status: 400 });
  }

  try {
    await upsertB2bRule(auth.DB, {
      id, category_name, discount_pct, min_quantity,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : 1,
    });
  } catch (e) {
    console.error('D1 Error in frontend/src/pages/api/admin/b2b-rules.ts:', e);
    return new Response(JSON.stringify({ error: 'Error al guardar la regla' }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }));
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  try {
    await deleteB2bRule(auth.DB, id);
  } catch (e) {
    console.error('D1 Error in frontend/src/pages/api/admin/b2b-rules.ts:', e);
    return new Response(JSON.stringify({ error: 'Error al eliminar la regla' }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }));
};
