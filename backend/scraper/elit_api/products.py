"""
Product fetcher: obtiene productos de ELIT y los normaliza al schema de StarTech.
"""
from slugify import slugify
from backend.scraper.elit_api.client import ElitClient
from backend.scraper.price_engine import calculate_price_from_elit


def normalize_elit_product(elit_product: dict) -> dict:
    cotizacion = float(elit_product.get("cotizacion", 0))
    pricing = calculate_price_from_elit(elit_product)

    images = []
    raw_images = elit_product.get("imagenes", [])
    if isinstance(raw_images, list):
        for img in raw_images:
            if isinstance(img, str):
                images.append(img)
            elif isinstance(img, dict):
                images.append(img.get("url", img.get("src", "")))

    raw_attrs = elit_product.get("atributos", [])
    attributes = []
    if isinstance(raw_attrs, list):
        for attr in raw_attrs:
            if isinstance(attr, dict):
                attributes.append({
                    "name": attr.get("nombre", attr.get("name", "")),
                    "value": attr.get("valor", attr.get("value", "")),
                })

    title = elit_product.get("nombre", "")
    slug = slugify(title)

    nivel_stock = elit_product.get("nivel_stock", "bajo")
    stock_total = int(elit_product.get("stock_total", 0))

    return {
        "id": f"elit_{elit_product.get('id', '')}",
        "external_id": str(elit_product.get("id", "")),
        "codigo_alfa": elit_product.get("codigo_alfa", ""),
        "sku": elit_product.get("codigo_producto", ""),
        "title": title,
        "slug": slug,
        "description": f"{title} - {elit_product.get('garantia', '')}",
        "category_name": elit_product.get("categoria", ""),
        "subcategory_name": elit_product.get("sub_categoria", ""),
        "brand": elit_product.get("marca", ""),
        "price": pricing["final_price"],
        "cost_price": pricing["cost_original"],
        "currency": pricing["currency"],
        "dollar_rate": pricing["dollar_rate"],
        "iva_pct": pricing["iva_pct"],
        "internal_tax_pct": pricing["internal_tax_pct"],
        "markup_pct": pricing["markup_pct"],
        "pvp_usd": float(elit_product.get("pvp_usd", 0)),
        "pvp_ars": float(elit_product.get("pvp_ars", 0)),
        "available_qty": stock_total,
        "stock": stock_total,
        "stock_level": nivel_stock,
        "ean": elit_product.get("ean", ""),
        "weight": float(elit_product.get("peso", 0)),
        "warranty": elit_product.get("garantia", ""),
        "link": elit_product.get("link", ""),
        "permalink": elit_product.get("link", ""),
        "thumbnail": images[0] if images else "",
        "images": images,
        "attributes": attributes,
        "is_gamer": bool(elit_product.get("gamer", False)),
        "provider": "elit",
        "provider_store": "minorista",
        "sync_source": "elit_api",
    }


def fetch_all_elit_products(max_products=None) -> list:
    client = ElitClient()
    raw = client.get_all_products(max_products=max_products)
    normalized = []
    for p in raw:
        try:
            normalized.append(normalize_elit_product(p))
        except Exception as e:
            print(f"[ELIT] Error normalizando producto {p.get('id', '?')}: {e}")
    return normalized


def fetch_elit_products_in_stock(max_products=None) -> list:
    all_products = fetch_all_elit_products(max_products)
    return [p for p in all_products if p["stock"] > 0]


def sync_elit_to_db(db, max_products=None):
    products = fetch_elit_products_in_stock(max_products)
    inserted = 0
    updated = 0

    for product in products:
        existing = db.get_product_by_external_id(product["external_id"], "elit")
        if existing:
            db.update_product(existing["id"], product)
            updated += 1
        else:
            db.insert_product(product)
            inserted += 1

    print(f"[ELIT] Sync completo: {inserted} insertados, {updated} actualizados, {len(products)} totales")
    return {"inserted": inserted, "updated": updated, "total": len(products)}
