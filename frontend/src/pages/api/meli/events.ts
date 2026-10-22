import type { PagesRequest, PagesResponse } from "@cloudflare/workers-types";

export const onRequest: PagesFunction = async (context) => {
  const { env } = context;
  
  try {
    const events = await env.DB.prepare(
      "SELECT * FROM meli_events ORDER BY created_at DESC LIMIT 50"
    ).all();
    
    return new Response(JSON.stringify(events.results), { 
      headers: { "Content-Type": "application/json" } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
  }
};
