"""
Fetch full product details from MercadoLibre API.
Requires authentication (ML_CLIENT_ID and ML_CLIENT_SECRET).
"""

import re
from backend.scraper.ml_api.client import MLClient
from backend.db.database import CatalogDB


def fetch_item_detail(item_id: str, include_description: bool = True) -> dict:
    """
    Fetch full product detail from MercadoLibre API.
    Returns dict with product data, attributes, and images.
    Saves everything to the database.
    """
    client = MLClient(use_auth=True)
    db = CatalogDB()
    db.initialize()

    try:
        data = client.get_item(item_id)
    except Exception as e:
        print(f"  Error fetching {item_id}: {e}")
        client.close()
        db.close()
        return None

    prod = _parse_item_detail(data)
    db.upsert_product(prod)

    # Save images
    pictures = data.get("pictures", [])
    for i, pic in enumerate(pictures):
        db.upsert_product_image({
            "product_id": item_id,
            "url_original": pic.get("url", "").replace("http://", "https://"),
            "sort_order": i,
        })

    # Save attributes
    attrs = []
    for attr in data.get("attributes", []):
        value = attr.get("value_name") or attr.get("value_id") or ""
        if value:
            attrs.append({
                "name": attr.get("name", ""),
                "value": value,
                "value_id": attr.get("value_id"),
                "attribute_group": attr.get("attribute_group"),
            })
    if attrs:
        db.upsert_product_attributes(item_id, attrs)

    # Save description
    if include_description:
        try:
            desc = client.get_item_description(item_id)
            if desc:
                db.conn.execute(
                    "UPDATE products SET description = ? WHERE id = ?",
                    (desc, item_id)
                )
                db.conn.commit()
        except Exception:
            pass

    client.close()
    db.close()
    return data


def fetch_item_detail_bulk(item_ids: list, progress_callback=None) -> list:
    """
    Fetch details for multiple items.
    """
    results = []
    for i, item_id in enumerate(item_ids):
        if progress_callback:
            progress_callback(i + 1, len(item_ids), item_id)
        data = fetch_item_detail(item_id)
        if data:
            results.append(data)
    return results


def fetch_item_images(item_id: str) -> list:
    """Fetch image URLs for an item."""
    client = MLClient(use_auth=True)
    try:
        data = client.get_item(item_id)
        return [pic.get("url", "") for pic in data.get("pictures", [])]
    except Exception as e:
        print(f"  Error fetching images for {item_id}: {e}")
        return []
    finally:
        client.close()


def _parse_item_detail(data: dict) -> dict:
    """Parse a ML item detail response into our product format."""
    seller = data.get("seller", {}) or {}
    shipping = data.get("shipping", {}) or {}

    prod = {
        "id": data["id"],
        "title": data.get("title", ""),
        "slug": _slugify(data.get("title", "")),
        "category_id": data.get("category_id"),
        "price": data.get("price"),
        "original_price": data.get("original_price"),
        "currency": data.get("currency_id", "ARS"),
        "condition": data.get("condition", "new"),
        "available_qty": data.get("available_quantity", 0),
        "sold_qty": data.get("sold_quantity", 0),
        "seller_id": str(data.get("seller_id", "")),
        "seller_nickname": seller.get("nickname", ""),
        "seller_reputation": _get_reputation(seller),
        "free_shipping": shipping.get("free_shipping", False),
        "listing_type": data.get("listing_type_id"),
        "permalink": data.get("permalink"),
        "thumbnail": data.get("thumbnail"),
    }
    return prod


def _get_reputation(seller: dict) -> float:
    try:
        return seller.get("seller_reputation", {}).get("transactions", {}).get("completed", 0)
    except (AttributeError, TypeError):
        return 0.0


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text[:200]
