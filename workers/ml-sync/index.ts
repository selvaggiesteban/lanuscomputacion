import { MeliClient } from '../../frontend/src/lib/meli';
import { MeliSyncService } from '../../frontend/src/lib/meli-sync-service';
import { getProducts } from '../../frontend/src/lib/d1';

export default {
  async scheduled(event, env, ctx) {
    const client = new MeliClient(env.DB, env.ML_CLIENT_ID, env.ML_CLIENT_SECRET);
    const syncService = new MeliSyncService(client);
    
    console.log("Starting scheduled ML sync...");
    
    try {
      const products = await getProducts(env.DB, { includeArchived: false });
      // Default category for global sync, should be mapped per product in next iteration
      const results = await syncService.syncAllProducts(products, null, env.DB);
      
      console.log(`Sync completed: ${results.created} created, ${results.updated} updated, ${results.failed} failed.`);
    } catch (e) {
      console.error("Scheduled ML sync failed:", e);
    }
  },
};
