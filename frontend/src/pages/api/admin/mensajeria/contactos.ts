import { getContacts, upsertContact, deleteContact } from '../../../lib/d1';

export async function GET({ locals }) {
  const db = locals.runtime.env.DB;
  try {
    const contacts = await getContacts(db);
    return new Response(JSON.stringify(contacts));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function POST({ request, locals }) {
  const db = locals.runtime.env.DB;
  try {
    const data = await request.json();
    const id = await upsertContact(db, data);
    return new Response(JSON.stringify({ success: true, id }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function PUT({ request, locals }) {
  const db = locals.runtime.env.DB;
  try {
    const data = await request.json();
    await upsertContact(db, data);
    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function DELETE({ request, locals }) {
  const db = locals.runtime.env.DB;
  try {
    const data = await request.json();
    await deleteContact(db, data.id);
    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}