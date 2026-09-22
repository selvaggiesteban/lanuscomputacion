import { getMessageTemplates, upsertMessageTemplate, deleteMessageTemplate } from '../../../lib/d1';

export async function GET({ locals }) {
  const db = locals.runtime.env.DB;
  try {
    const templates = await getMessageTemplates(db);
    return new Response(JSON.stringify(templates));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  try {
    const data = await request.json();
    await upsertMessageTemplate(db, data);
    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function PUT({ request, locals }) {
  const db = locals.runtime.env.DB;
  try {
    const data = await request.json();
    await upsertMessageTemplate(db, data);
    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function DELETE({ request, locals }) {
  const db = locals.runtime.env.DB;
  try {
    const data = await request.json();
    await deleteMessageTemplate(db, data.id);
    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}