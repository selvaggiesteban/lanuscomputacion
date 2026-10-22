import type { PagesRequest, PagesResponse } from "@cloudflare/workers-types";

export const onRequest: PagesFunction = async (context) => {
  const { env } = context;
  
  try {
    const total = await env.DB.prepare("SELECT COUNT(*) as count FROM products").first<{ count: number }>();
    const synced = await env.DB.prepare("SELECT COUNT(*) as count FROM products WHERE ml_item_id IS NOT NULL").first<{ count: number }>();
    
    return new Response(JSON.stringify({
      total: total?.count || 0,
      synced: synced?.count || 0
    }), { 
      headers: { "Content-Type": "application/json" } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
  }
};
