import type { PagesRequest, PagesResponse } from "@cloudflare/workers-types";
import { MeliClient } from "../../../lib/meli";

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const topic = url.searchParams.get("topic");
  const resourceId = url.searchParams.get("resource_id");

  // 1. Immediate 200 OK to MELI
  if (!topic || !resourceId) return new Response("OK", { status: 200 });

  try {
    const client = new MeliClient(env.DB, env.ML_CLIENT_ID, env.ML_CLIENT_SECRET);
    
    // Handle 'orders' notification
    if (topic === "orders") {
      const order = await client.request(`/orders/${resourceId}`);
      
      // Log the event for the digest
      await env.DB.prepare(
        "INSERT INTO meli_events (event_type, item_id, payload) VALUES (?, ?, ?)"
      ).bind("sale", order.id, `Venta confirmada: ${order.status}`).run();

      // Discount stock in D1
      // We need to find the product linked to the order item
      const orderItems = await client.request(`/orders/${resourceId}/items`);
      for (const item of orderItems) {
        await env.DB.prepare("UPDATE products SET available_qty = available_qty - ? WHERE ml_item_id = ?")
          .bind(item.quantity, item.item.id)
          .run();
      }
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("ML Webhook Error:", error);
    return new Response("Internal Error", { status: 500 });
  }
};
