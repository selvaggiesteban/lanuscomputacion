import { getMessageTemplates, upsertMessageTemplate, deleteMessageTemplate } from '../../../../lib/d1';
import { requireAdmin, unauthorized } from '../../../../lib/admin-auth';

export async function GET({ locals, request }) {
  const auth = await requireAdmin(locals, request);
  if (!auth) return unauthorized();
  try {
    const templates = await getMessageTemplates(auth.DB);
    return new Response(JSON.stringify(templates));
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
    await upsertMessageTemplate(auth.DB, data);
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
    await upsertMessageTemplate(auth.DB, data);
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
    await deleteMessageTemplate(auth.DB, data.id);
    return new Response(JSON.stringify({ success: true }));
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
