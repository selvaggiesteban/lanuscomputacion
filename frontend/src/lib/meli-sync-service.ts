import { MeliClient } from './meli';
import { mapProductToMeli } from './meli-mapper';
import { logMeliEvent, type Product } from './d1';

// ─── Categorías Mercado Libre ────────────────────────────────────────────────
// Mapa estático taxonomía D1 → categoría MLA. Todos los IDs fueron verificados
// contra GET https://api.mercadolibre.com/categories/MLA… (23/10/2026):
// son hojas reales con listing_allowed = true (ML solo publica en hojas).
// Los buckets mixtos (ej. impresión = impresoras + insumos) apuntan a la hoja
// "Otros" de su rama en lugar de adivinar una categoría concreta.
// Prioridad en resolveMeliCategoryId: ml_category_id del producto (override
// manual) → subcategory_name (más específico) → category_id.

// subcategory_name de la taxonomía ELIT (workers/sync-elit/category_mapping.ts)
const SUBCATEGORY_MELI: Record<string, string> = {
  // Celulares
  sub_celulares_smartphones: 'MLA1055', // Celulares y Smartphones
  sub_celulares_accesorios: 'MLA3529', // Otros · Accesorios para Celulares
  sub_celulares_repuestos: 'MLA5549', // Otros Repuestos · Repuestos de Celulares
  // Cámaras (en ELIT son cámaras de seguridad / webcams, no fotográficas)
  sub_camaras_digitales: 'MLA5959', // Cámaras de Seguridad
  sub_camaras_accesorios: 'MLA3357', // Otros · Accesorios para Cámaras
  sub_camaras_filmadoras: 'MLA392132', // Filmadoras y Cámaras de Acción
  // Consolas
  sub_consolas_videojuegos: 'MLA373840', // Videojuegos
  sub_consolas_playstation: 'MLA438566', // Consolas
  sub_consolas_nintendo: 'MLA438566', // Consolas
  // Computación
  sub_computacion_pc: 'MLA1652', // Notebooks (dominante en el bucket PC)
  sub_computacion_componentes: 'MLA83769', // Otros · Componentes de PC
  sub_computacion_impresion: 'MLA3570', // Otros · Impresión
  sub_computacion_conectividad: 'MLA1710', // Otros · Conectividad y Redes
  sub_computacion_monitores: 'MLA14407', // Monitores
  sub_computacion_almacenamiento: 'MLA430604', // Otros · Discos y Accesorios
  sub_computacion_cables: 'MLA430919', // Otros · Cables y Hubs USB
  sub_computacion_energia: 'MLA1722', // Otros · Estabilizadores y UPS
  // Electrónica
  sub_electronica_audio: 'MLA409811', // Otros · Audio
  sub_electronica_accesorios_audio: 'MLA3698', // Otros · Accesorios para Audio y Video
  sub_electronica_componentes: 'MLA12812', // Otros · Componentes Electrónicos
  sub_electronica_drones: 'MLA410298', // Drones
  sub_electronica_audio_vehiculos: 'MLA3387', // Otros · Audio para Vehículos
  sub_electronica_televisores: 'MLA1002', // Televisores
  // Sin equivalencia confiable (se resuelve por category_id):
  // sub_computacion_tablets (bucket ELIT mezcla tablets con teclados/mochilas) y
  // sub_computacion_memorias (mezcla memorias RAM con pendrives/flash).
};

// category_id de products: taxonomía de la tienda (cat_*) + slugs que genera el
// scraper de ML a partir de las URLs (backend/scraper/ml/normalizer.py)
const CATEGORY_MELI: Record<string, string> = {
  // Taxonomía propia (ELIT / seed)
  cat_celulares: 'MLA1055', // Celulares y Smartphones
  cat_camaras: 'MLA5959', // Cámaras de Seguridad
  cat_consolas: 'MLA438566', // Consolas
  cat_computacion: 'MLA1912', // Otros · Computación
  cat_electronica: 'MLA1070', // Otros · Electrónica, Audio y Video
  // Slugs del scraper de ML
  'celulares-telefonos': 'MLA1055', // Celulares y Smartphones
  'celulares-smartphones': 'MLA1055', // Celulares y Smartphones
  'accesorios-celulares': 'MLA3529', // Otros · Accesorios para Celulares
  'repuestos-celulares': 'MLA5549', // Otros Repuestos · Repuestos de Celulares
  'camaras-digitales': 'MLA1042', // Cámaras Digitales (fotográficas)
  'camaras-accesorios': 'MLA3357', // Otros · Accesorios para Cámaras
  'accesorios-camaras': 'MLA3357', // Otros · Accesorios para Cámaras
  'camaras-accion': 'MLA392132', // Filmadoras y Cámaras de Acción
  'consolas-videojuegos': 'MLA438566', // Consolas
  'videojuegos': 'MLA373840', // Videojuegos
  'accesorios-consolas': 'MLA438759', // Otros · Consolas y Videojuegos
  'computacion': 'MLA1912', // Otros · Computación
  'componentes-pc': 'MLA83769', // Otros · Componentes de PC
  'impresion': 'MLA3570', // Otros · Impresión
  'tablets': 'MLA82085', // Tablets
  'pc-escritorio': 'MLA1649', // PC
  'conectividad-redes': 'MLA1710', // Otros · Conectividad y Redes
  'monitores-accesorios': 'MLA14407', // Monitores
  'electronica-audio-video': 'MLA1070', // Otros · Electrónica, Audio y Video
  'audio': 'MLA409811', // Otros · Audio
  'accesorios-audio-video': 'MLA3698', // Otros · Accesorios para Audio y Video
  'componentes-electronicos': 'MLA12812', // Otros · Componentes Electrónicos
  'drones-accesorios': 'MLA410298', // Drones
  'televisores': 'MLA1002', // Televisores
  'audio-vehiculos': 'MLA3387', // Otros · Audio para Vehículos
  // 'uncategorized' y cualquier otro slug sin mapear → null (producto salteado)
};

const MLA_ID_RE = /^MLA\d+$/;

// Resuelve la categoría MLA para un producto. null = sin categoría utilizable:
// el caller debe saltear el producto (no se publica con una categoría inventada).
export function resolveMeliCategoryId(product: Product): string | null {
  const override = product.ml_category_id?.trim();
  if (override) return override;

  const subcategory = product.subcategory_name?.trim();
  if (subcategory && MLA_ID_RE.test(subcategory)) return subcategory;
  if (subcategory && SUBCATEGORY_MELI[subcategory]) return SUBCATEGORY_MELI[subcategory];

  const category = product.category_id?.trim();
  if (!category) return null;
  if (MLA_ID_RE.test(category)) return category;

  return CATEGORY_MELI[category] ?? null;
}

export type SyncAction = 'created' | 'updated' | 'skipped' | 'error';

export interface SyncProductResult {
  success: boolean;
  action: SyncAction;
  mlItemId?: string;
  message?: string;
}

export class MeliSyncService {
  private client: MeliClient;

  constructor(client: MeliClient) {
    this.client = client;
  }

  // Idempotente: si el producto ya tiene ml_item_id hace PUT (update); si no,
  // crea el ítem y guarda el ID devuelto en products.ml_item_id.
  async syncProduct(product: Product, meliCategoryId: string | null, db: D1Database): Promise<SyncProductResult> {
    const categoryId = meliCategoryId ?? resolveMeliCategoryId(product);

    if (!categoryId) {
      await logMeliEvent(db, {
        eventType: 'meli_sync',
        entity: 'product',
        entityId: product.id,
        status: 'skipped',
        message: 'missing_category',
        payload: { title: product.title, category_id: product.category_id, subcategory_name: product.subcategory_name },
      });
      return { success: true, action: 'skipped', message: 'missing_category' };
    }

    try {
      if (product.ml_item_id) {
        // Update existente: precio y stock son los campos sincronizables.
        await this.client.request(`/items/${product.ml_item_id}`, 'PUT', {
          price: product.price,
          available_quantity: Math.max(0, Math.floor(product.available_qty ?? 0)),
        });
        await logMeliEvent(db, {
          eventType: 'meli_sync',
          entity: 'product',
          entityId: product.id,
          status: 'updated',
          message: `Actualizado ${product.ml_item_id}`,
          payload: { price: product.price, available_quantity: product.available_qty },
        });
        return { success: true, action: 'updated', mlItemId: product.ml_item_id };
      }

      const payload = mapProductToMeli(product, categoryId);
      const item = await this.client.request<{ id: string }>('/items', 'POST', payload);

      // Vincula el ítem creado con el producto local.
      await db.prepare('UPDATE products SET ml_item_id = ? WHERE id = ?')
        .bind(item.id, product.id)
        .run();

      await logMeliEvent(db, {
        eventType: 'meli_sync',
        entity: 'product',
        entityId: product.id,
        status: 'created',
        message: `Creado ${item.id}`,
        payload: { ml_item_id: item.id, category_id: categoryId },
      });
      return { success: true, action: 'created', mlItemId: item.id };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await logMeliEvent(db, {
        eventType: 'meli_sync',
        entity: 'product',
        entityId: product.id,
        status: 'error',
        message,
        payload: {
          title: product.title,
          ml_item_id: product.ml_item_id ?? null,
          category_id: categoryId,
        },
      });
      throw e;
    }
  }

  // Un error por producto no corta la tanda: se registra y se sigue con el resto.
  async syncAllProducts(
    products: Product[],
    meliCategoryId: string | null,
    db: D1Database,
  ): Promise<{ created: number; updated: number; failed: number; skipped: number }> {
    const results = { created: 0, updated: 0, failed: 0, skipped: 0 };

    for (const product of products) {
      try {
        const res = await this.syncProduct(product, meliCategoryId, db);
        if (res.action === 'created') results.created++;
        else if (res.action === 'updated') results.updated++;
        else if (res.action === 'skipped') results.skipped++;
        else if (res.action === 'error') results.failed++;
      } catch (e) {
        // syncProduct ya dejó el evento de error (event_type meli_sync); acá se
        // agrega uno de lote para tener trazabilidad del recorrido completo.
        results.failed++;
        console.error(`Failed to sync ${product.title}:`, e);
        await logMeliEvent(db, {
          eventType: 'meli_sync_batch',
          entity: 'product',
          entityId: product.id,
          status: 'error',
          message: e instanceof Error ? e.message : String(e),
          payload: { title: product.title, ml_item_id: product.ml_item_id ?? null },
        });
      }
    }

    // Deja constancia de la última sincronización completa (la tabla puede no
    // existir todavía si la migración 022 no corrió).
    try {
      await db.prepare("UPDATE meli_tokens SET last_sync_at = datetime('now') WHERE id = 1").run();
    } catch (e) {
      console.error('No se pudo actualizar meli_tokens.last_sync_at:', e);
    }

    return results;
  }
}
