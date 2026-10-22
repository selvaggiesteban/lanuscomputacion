import type { Product } from './d1';

export interface MeliItem {
  title: string;
  category_id: string;
  price: number;
  currency_id: string;
  available_quantity: number;
  condition: string;
  listing_type: string;
  status: string;
  picture: string[];
  description: {
    plain_text: string;
  };
}

export function mapProductToMeli(product: Product, meliCategoryId: string): MeliItem {
  return {
    title: product.title.substring(0, 60), // ML Limit: 60 chars
    category_id: meliCategoryId,
    price: product.price,
    currency_id: 'ARS',
    available_quantity: product.available_qty,
    condition: 'new',
    listing_type: 'gold_special', // Premium listing
    status: 'active',
    picture: [product.thumbnail],
    description: {
      plain_text: product.description,
    },
  };
}
