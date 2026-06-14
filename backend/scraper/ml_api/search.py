"""
Search products on MercadoLibre using the authenticated API.
Requires ML_CLIENT_ID and ML_CLIENT_SECRET environment variables.
"""

import re
from datetime import datetime
from backend.scraper.ml_api.client import MLClient
from backend.db.database import CatalogDB


def search_products_by_category(
    category_id: str,
    max_items: int = 1000,
    sort: str = None,
    progress_callback=None
) -> list:
    """
    Search products in a category using the authenticated ML API.
    Saves each product to the database, returns saved product IDs.
    """
    client = MLClient(use_auth=True)
    db = CatalogDB()
    db.initialize()

    saved_ids = []
    offset = 0
    limit = 50
    page = 0

    while offset < max_items:
        try:
            data = client.search(category_id, limit=limit, offset=offset, sort=sort)
        except Exception as e:
            print(f"  Error: {e}")
            break

        results = data.get("results", [])
        if not results:
            print(f"  No more results at offset {offset}")
            break

        for item in results:
            prod = _parse_search_result(item, category_id)
            db.upsert_product(prod)
            saved_ids.append(prod["id"])

        paging = data.get("paging", {})
        total = paging.get("total", 0)
        offset += limit
        page += 1

        if progress_callback:
            progress_callback(category_id, page, len(saved_ids), total)
        else:
            print(f"  Page {page}: saved {len(results)} products (total so far: {len(saved_ids)})")

        # Stop if we've got all available results
        if offset >= total:
            break

    client.close()
    db.close()
    return saved_ids


def search_products_by_query(
    query: str,
    category_id: str = None,
    limit: int = 50,
    sort: str = None,
) -> list:
    """
    Search products by query text using the authenticated API.
    Returns raw API results (does not save to DB).
    """
    client = MLClient(use_auth=True)
    try:
        data = client.search_by_query(query, category_id=category_id, limit=limit, sort=sort)
        return data.get("results", [])
    except Exception as e:
        print(f"  Search error: {e}")
        return []
    finally:
        client.close()


def _parse_search_result(item: dict, category_id: str) -> dict:
    """Parse a ML API search result into our product format."""
    seller = item.get("seller", {}) or {}
    shipping = item.get("shipping", {}) or {}
    installments = item.get("installments", {}) or {}

    return {
        "id": item["id"],
        "title": item.get("title", ""),
        "slug": _slugify(item.get("title", "")),
        "category_id": category_id,
        "price": item.get("price"),
        "original_price": item.get("original_price"),
        "currency": item.get("currency_id", "ARS"),
        "condition": item.get("condition", "new"),
        "available_qty": item.get("available_quantity", 0),
        "sold_qty": item.get("sold_quantity", 0),
        "seller_id": str(seller.get("id", "")),
        "seller_nickname": seller.get("nickname", ""),
        "free_shipping": shipping.get("free_shipping", False),
        "listing_type": item.get("listing_type_id"),
        "permalink": item.get("permalink"),
        "thumbnail": item.get("thumbnail"),
        "rating": installments.get("rate", 0) or 0,
    }


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text[:200]
