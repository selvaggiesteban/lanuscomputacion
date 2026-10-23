import type { Product } from './d1';

// Payload para POST /items según la documentación vigente de Mercado Libre
// (developers.mercadolibre.com.ar → "List products"): title, category_id,
// price, currency_id, available_quantity, condition, listing_type_id,
// buying_mode y pictures[{source}]. El campo `picture` (string/lista) y
// `listing_type` NO existen: se usan `pictures` y `listing_type_id`.
// sale_terms / attributes / free_shipping no son obligatorios a nivel API
// (los requeridos por categoría se validan con /categories/{id}/attributes) y
// se omiten para no inventar valores.
export interface MeliItemPicture {
  source: string;
}

export interface MeliItem {
  title: string;
  category_id: string;
  price: number;
  currency_id: 'ARS';
  available_quantity: number;
  condition: 'new';
  buying_mode: 'buy_it_now';
  listing_type_id: string;
  pictures?: MeliItemPicture[];
  description?: {
    plain_text: string;
  };
}

// Dominio del sitio: los thumbnails se guardan como rutas relativas (/img/…).
const SITE_URL = 'https://lanuscomputacion.com';
// Límites de la categoría (settings.max_title_length / max_description_length).
const TITLE_MAX = 60;
const DESCRIPTION_MAX = 50000;

// URL absoluta usable por ML. Devuelve null cuando la imagen no sirve
// (vacía, data: URI o placeholder del sitio).
export function toAbsoluteImageUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? '').trim();
  if (!url) return null;
  if (/^(data|javascript):/i.test(url)) return null;
  if (url.toLowerCase().includes('placeholder')) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('//')) return `https:${url}`;
  return `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}

// plain_text no admite marcado: dejamos el texto legible.
function toPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mapProductToMeli(product: Product, meliCategoryId: string): MeliItem {
  const picture = toAbsoluteImageUrl(product.thumbnail);

  const item: MeliItem = {
    title: (product.title ?? '').trim().substring(0, TITLE_MAX),
    category_id: meliCategoryId,
    price: product.price,
    currency_id: 'ARS',
    available_quantity: Math.max(0, Math.floor(product.available_qty ?? 0)),
    condition: 'new',
    buying_mode: 'buy_it_now',
    listing_type_id: 'gold_special', // Premium (listing_type_id, no `listing_type`)
  };

  // Sin imagen utilizable se omite `pictures`; ML puede rechazar la creación
  // (HTTP 400, error 173 LTP_PICTURE_REQUIRED) en ese caso, y el error queda
  // registrado en meli_events por MeliSyncService.
  if (picture) {
    item.pictures = [{ source: picture }];
  }

  const description = toPlainText(product.description ?? '');
  if (description) {
    item.description = { plain_text: description.substring(0, DESCRIPTION_MAX) };
  }

  return item;
}
