import type { APIRoute } from "astro";
import { getUserFromRequest } from "../../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const jwtSecret = locals.runtime.env.JWT_SECRET as string;

  if (!jwtSecret) {
    return new Response(JSON.stringify({ error: "JWT_SECRET no configurado" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await getUserFromRequest(request, db, jwtSecret);

  if (!user) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.is_admin === 1,
      isB2b: user.is_b2b === 1,
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
