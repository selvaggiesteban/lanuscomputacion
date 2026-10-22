import type { PagesRequest, PagesResponse } from "@cloudflare/workers-types";
import { MeliClient } from "../../../lib/meli";
import { MeliSyncService } from "../../../../lib/meli-sync-service";
import { getProducts } from "../../../lib/d1";

export const onRequest: PagesFunction = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  const client = new MeliClient(env.DB, env.ML_CLIENT_ID, env.ML_CLIENT_SECRET);
  const syncService = new MeliSyncService(client);

  try {
    if (productId) {
      // Sync single product
      const product = await env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(productId).first();
      if (!product) return new Response("Product not found", { status: 404 });
      
      // Use a default category for now, in a real scenario this would be mapped from D1 category
      const result = await syncService.syncProduct(product, "MLA1234", env.DB); 
      return new Response(JSON.stringify(result), { status: 200 });
    } else {
      // Sync all published products
      const products = await getProducts(env.DB, { includeArchived: false });
      const result = await syncService.syncAllProducts(products, "MLA1234", env.DB);
      return new Response(JSON.stringify(result), { status: 200 });
    }
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
