import { getAllNfcCards, getNfcCardBySlug, upsertNfcCard, deleteNfcCard } from '../../../lib/d1';
import { requireAdmin, unauthorized } from '../../../lib/admin-auth';

export async function GET({ request, locals }) {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  const db = auth.DB;
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug');
  const cardNumber = url.searchParams.get('number');

  try {
    if (slug) {
      const card = await getNfcCardBySlug(db, slug);
      if (!card) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      return new Response(JSON.stringify(card));
    }
    if (cardNumber) {
      const card = await getNfcCardBySlug(db, `p/${cardNumber}`);
      if (!card) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
      return new Response(JSON.stringify(card));
    }
    const cards = await getAllNfcCards(db);
    return new Response(JSON.stringify(cards));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function POST({ request, locals }) {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  try {
    const data = await request.json();
    if (data.is_active !== undefined) data.is_active = data.is_active ? 1 : 0;
    if (!data.target_id) data.target_id = null;
    await upsertNfcCard(auth.DB, data);
    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function PUT({ request, locals }) {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  try {
    const data = await request.json();
    if (data.is_active !== undefined) data.is_active = data.is_active ? 1 : 0;
    if (!data.target_id) data.target_id = null;
    await upsertNfcCard(auth.DB, data);
    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function DELETE({ request, locals }) {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  try {
    const data = await request.json();
    await deleteNfcCard(auth.DB, data.id);
    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
