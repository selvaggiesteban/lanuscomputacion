import type { APIRoute } from 'astro';
import { getB2bRules, upsertB2bRule, deleteB2bRule } from '../../../lib/d1';

export const GET: APIRoute = async ({ locals }) => {
  const { env } = locals as { env: { DB: D1Database } };
  const rules = await getB2bRules(env.DB);
  return new Response(JSON.stringify(rules));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const { env } = locals as { env: { DB: D1Database } };
  const body = await request.json();
  const { id, category_name, discount_pct, min_quantity, is_active } = body;

  if (!id || !category_name || discount_pct === undefined || min_quantity === undefined) {
    return new Response(JSON.stringify({ error: 'Campos obligatorios faltantes' }), { status: 400 });
  }

  await upsertB2bRule(env.DB, { id, category_name, discount_pct, min_quantity, is_active });
  return new Response(JSON.stringify({ ok: true }));
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const { env } = locals as { env: { DB: D1Database } };
  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  await deleteB2bRule(env.DB, id);
  return new Response(JSON.stringify({ ok: true }));
};
