import { calculatePriceFromElit } from "./pricing";
import { mapElitToCategory } from "./category_mapping";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface NormalizedProduct {
  id: string;
  external_id: string;
  codigo_alfa: string;
  sku: string;
  title: string;
  slug: string;
  description: string;
  category_id: string;
  category_name: string;
  subcategory_name: string;
  brand: string;
  price: number;
  cost_price: number;
  currency: string;
  dollar_rate: number;
  iva_pct: number;
  internal_tax_pct: number;
  markup_pct: number;
  available_qty: number;
  ean: string;
  weight: number;
  warranty: string;
  permalink: string;
  thumbnail: string;
  images: string[];
  provider: string;
  provider_store: string;
}

export function normalizeElitProduct(elitProduct: Record<string, any>): NormalizedProduct {
  const pricing = calculatePriceFromElit(elitProduct);

  const images: string[] = [];
  const rawImages = elitProduct.imagenes ?? [];
  if (Array.isArray(rawImages)) {
    for (const img of rawImages) {
      if (typeof img === "string") images.push(img);
      else if (typeof img === "object" && img !== null)
        images.push(img.url ?? img.src ?? "");
    }
  }

  const title = String(elitProduct.nombre ?? "");
  const slug = slugify(title);
  const stockTotal = Number(elitProduct.stock_total ?? 0);
  const nivelStock = String(elitProduct.nivel_stock ?? "bajo");

  const elitCategory = String(elitProduct.categoria ?? "");
  const elitSubcategory = String(elitProduct.sub_categoria ?? "");

  // Map ELIT categories to our taxonomy
  const mapping = mapElitToCategory(elitCategory, elitSubcategory);
  const categoryId = mapping?.category_id ?? "uncategorized";
  const subcategoryName = mapping?.subcategory_name ?? elitSubcategory;

  return {
    id: `elit_${elitProduct.id ?? ""}`,
    external_id: String(elitProduct.id ?? ""),
    codigo_alfa: String(elitProduct.codigo_alfa ?? ""),
    sku: String(elitProduct.codigo_producto ?? ""),
    title,
    slug,
    description: `${title} - ${elitProduct.garantia ?? ""}`,
    category_id: categoryId,
    category_name: elitCategory,
    subcategory_name: subcategoryName,
    brand: String(elitProduct.marca ?? ""),
    price: pricing.final_price,
    cost_price: pricing.cost_original,
    currency: pricing.currency,
    dollar_rate: pricing.dollar_rate,
    iva_pct: pricing.iva_pct,
    internal_tax_pct: pricing.internal_tax_pct,
    markup_pct: pricing.markup_pct,
    available_qty: stockTotal,
    ean: String(elitProduct.ean ?? ""),
    weight: Number(elitProduct.peso ?? 0),
    warranty: String(elitProduct.garantia ?? ""),
    permalink: String(elitProduct.link ?? ""),
    thumbnail: images[0] ?? "",
    images,
    provider: "elit",
    provider_store: "minorista",
  };
}
