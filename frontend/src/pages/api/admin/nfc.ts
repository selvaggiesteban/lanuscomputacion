import { getAllNfcCards, getNfcCardBySlug, upsertNfcCard, deleteNfcCard, incrementNfcScanCount } from '../../../lib/d1';

export async function GET({ request, locals }) {
  const db = locals.runtime.env.DB;
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
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  try {
    const data = await request.json();
    await upsertNfcCard(db, data);
    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function PUT({ request, locals }) {
  const db = locals.runtime.env.DB;
  try {
    const data = await request.json();
    await upsertNfcCard(db, data);
    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function DELETE({ request, locals }) {
  const db = locals.runtime.env.DB;
  try {
    const data = await request.json();
    await deleteNfcCard(db, data.id);
    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}