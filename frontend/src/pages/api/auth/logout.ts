import type { APIRoute } from "astro";
import { clearSessionCookie } from "../../../lib/auth";

export const POST: APIRoute = async ({}) => {
  const cookie = clearSessionCookie();

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": cookie,
    },
  });
};

export const GET: APIRoute = async ({}) => {
  const cookie = clearSessionCookie();

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie": cookie,
    },
  });
};
