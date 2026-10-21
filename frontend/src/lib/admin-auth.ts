import { getUserFromRequest, getJwtSecret } from "./auth";

export async function requireAdmin(locals: any, request: Request) {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);
  if (!user || !user.is_admin) return null;
  return { DB, user };
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "No autorizado" }), {
    status: 403,
    headers: { "Content-Type": "application/json" },
  });
}
