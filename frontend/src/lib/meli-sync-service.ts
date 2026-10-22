import { MeliClient } from './meli';
import { mapProductToMeli } from './meli-mapper';
import type { Product } from './d1';

export class MeliSyncService {
  private client: MeliClient;

  constructor(client: MeliClient) {
    this.client = client;
  }

  async syncProduct(product: Product, meliCategoryId: string, db: any) {
    if (product.ml_item_id) {
      // Update existing item
      await this.client.request(
        `/items/${product.ml_item_id}`,
        'PUT',
        {
          price: product.price,
          available_quantity: product.available_qty,
        }
      );
      return { success: true, action: 'updated' };
    } else {
      // Create new item
      const payload = mapProductToMeli(product, meliCategoryId);
      const item = await this.client.request<{ ml_item_id: string }>(
        '/items',
        'POST',
        payload
      );
      
      // Store the ML ID in D1
      await db.prepare("UPDATE products SET ml_item_id = ? WHERE id = ?")
        .bind(item.id, product.id)
        .run();
        
      return { success: true, action: 'created' };
    }
  }

  async syncAllProducts(products: Product[], meliCategoryId: string, db: any) {
    const results = { created: 0, updated: 0, failed: 0 };
    
    for (const product of products) {
      try {
        const res = await this.syncProduct(product, meliCategoryId, db);
        if (res.action === 'created') results.created++;
        else results.updated++;
      } catch (e) {
        console.error(`Failed to sync ${product.title}:`, e);
        results.failed++;
      }
    }
    
    return results;
  }
}
