import type { APIContext } from 'astro';
import { getContacts, upsertContact, deleteContact } from '../../../../lib/d1';
import { requireAdmin, unauthorized } from '../../../../lib/admin-auth';

export async function GET({ locals, request }: APIContext) {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  try {
    const contacts = await getContacts(auth.DB);
    return new Response(JSON.stringify(contacts));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function POST({ request, locals }: APIContext) {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  try {
    const data = await request.json();
    if (data.is_subscribed !== undefined) data.is_subscribed = data.is_subscribed ? 1 : 0;
    const id = await upsertContact(auth.DB, data);
    return new Response(JSON.stringify({ success: true, id }));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function PUT({ request, locals }: APIContext) {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  try {
    const data = await request.json();
    if (data.is_subscribed !== undefined) data.is_subscribed = data.is_subscribed ? 1 : 0;
    await upsertContact(auth.DB, data);
    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function DELETE({ request, locals }: APIContext) {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  try {
    const data = await request.json();
    await deleteContact(auth.DB, data.id);
    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
