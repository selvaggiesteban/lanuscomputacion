import type { PagesRequest, PagesResponse } from "@cloudflare/workers-types";

export const onRequest: PagesFunction = async (context) => {
  const { env } = context;
  
  try {
    const token = await env.DB.prepare("SELECT * FROM meli_tokens WHERE id = 1").first();
    return new Response(JSON.stringify({
      connected: !!token,
      lastUpdated: token?.updated_at || null
    }), { 
      headers: { "Content-Type": "application/json" } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ connected: false }), { status: 500 });
  }
};
