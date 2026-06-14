import time
from datetime import datetime
from backend.scraper.ml_api.client import MLClient
from backend.db.database import CatalogDB


def fetch_category_tree(main_category_id: str = "MLA1648", max_depth: int = 3):
    """
    Fetch the full category tree starting from a root category.
    Returns a flat list of category dicts with parent references.
    """
    client = MLClient()
    db = CatalogDB()
    db.initialize()

    categories = []
    seen = set()

    def recurse(cat_id: str, parent_id: str = None, depth: int = 0):
        if depth > max_depth or cat_id in seen:
            return
        seen.add(cat_id)

        try:
            data = client.get_category(cat_id)
        except Exception as e:
            print(f"  Error fetching category {cat_id}: {e}")
            return

        cat = {
            "id": data["id"],
            "name": data["name"],
            "slug": data["name"].lower().replace(" ", "-").replace(",", "").replace("ñ", "n")[:200],
            "parent_id": parent_id,
            "level": depth,
            "total_items": data.get("total_items_in_this_category", 0),
            "picture": data.get("picture"),
            "permalink": data.get("permalink"),
        }
        categories.append(cat)
        db.upsert_category(cat)
        print(f"  {'  ' * depth}{cat['name']} ({cat['id']}) - {cat['total_items']} items")

        for child in data.get("children_categories", []):
            recurse(child["id"], parent_id=cat["id"], depth=depth + 1)

    print(f"Fetching category tree for {main_category_id}...")
    recurse(main_category_id)
    client.close()
    db.close()
    return categories


def fetch_all_tecnologia_subcategories():
    """
    Fetch all subcategories under Tecnología (MLA categories).
    Returns the known category IDs for Tecnología.
    """
    return [
        "MLA1051",  # Celulares y Teléfonos
        "MLA1648",  # Computación
        "MLA1000",  # Electrónica, Audio y Video
        "MLA1144",  # Consolas y Videojuegos
        "MLA1039",  # Cámaras y Accesorios
    ]


def get_category_path(category_id: str, db: CatalogDB = None) -> list:
    """
    Build breadcrumb path from category to root.
    """
    close_db = False
    if db is None:
        db = CatalogDB()
        db.initialize()
        close_db = True

    path = []
    current_id = category_id
    while current_id:
        cat = db.get_category(current_id)
        if not cat:
            break
        path.insert(0, cat)
        current_id = cat.get("parent_id")

    if close_db:
        db.close()
    return path
