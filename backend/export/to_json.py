"""Export catalog to JSON files for Astro frontend consumption."""


def export_to_json(include_pending: bool = True):
    from backend.db.database import CatalogDB
    from pathlib import Path
    import json

    db = CatalogDB()
    db.initialize()

    exports_dir = Path(__file__).resolve().parent.parent.parent / "data" / "exports"
    frontend_data_dir = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "data"
    exports_dir.mkdir(parents=True, exist_ok=True)
    frontend_data_dir.mkdir(parents=True, exist_ok=True)

    # Export categories
    cats = db.conn.execute("SELECT * FROM categories ORDER BY level, name").fetchall()
    categories = [dict(r) for r in cats]

    cat_path = exports_dir / "categories.json"
    with open(cat_path, "w", encoding="utf-8") as f:
        json.dump(categories, f, ensure_ascii=False, indent=2, default=str)
    print(f"Categories: {len(categories)} -> {cat_path}")

    # Copy to frontend data dir
    cat_fe_path = frontend_data_dir / "categories.json"
    with open(cat_fe_path, "w", encoding="utf-8") as f:
        json.dump(categories, f, ensure_ascii=False, indent=2, default=str)

    # Export published products
    prods = db.conn.execute("""
        SELECT p.*, c.name as category_name, c.slug as category_slug
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'published'
        ORDER BY c.name, p.title
    """).fetchall()
    products = [dict(r) for r in prods]

    prod_path = exports_dir / "published_catalog.json"
    with open(prod_path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2, default=str)
    print(f"Published products: {len(products)} -> {prod_path}")

    # Copy to frontend
    prod_fe_path = frontend_data_dir / "products.json"
    with open(prod_fe_path, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2, default=str)

    # Export individual product files for Astro dynamic routes
    prods_dir = frontend_data_dir / "products"
    prods_dir.mkdir(exist_ok=True)
    for prod in products:
        slug = prod.get("slug", "")
        if slug:
            prod_file = prods_dir / f"{slug}.json"
            with open(prod_file, "w", encoding="utf-8") as f:
                json.dump(prod, f, ensure_ascii=False, indent=2, default=str)

    print(f"Individual product files: {len(products)} -> {prods_dir}/")

    db.close()
