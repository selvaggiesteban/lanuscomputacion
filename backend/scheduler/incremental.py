"""Incremental update scheduler for product catalog."""


def run_incremental_update():
    from backend.db.database import CatalogDB

    db = CatalogDB()
    db.initialize()
    print("Running incremental update...")

    categories = db.conn.execute("""
        SELECT * FROM categories
        WHERE is_active = 1 AND parent_id IS NOT NULL
        ORDER BY priority, name
    """).fetchall()

    for cat in categories:
        d = dict(cat)
        cat_id = d["id"]
        frequency_h = d.get("priority", 3) * 24  # priority 1=24h, 2=48h, 3=72h

        checkpoint = db.get_checkpoint(cat_id)
        if checkpoint:
            from datetime import datetime, timedelta
            completed = checkpoint.get("completed_at")
            if completed:
                completed_dt = datetime.fromisoformat(completed)
                if datetime.utcnow() - completed_dt < timedelta(hours=frequency_h):
                    continue  # Skip if not enough time has passed

        print(f"  Updating {d['name']} ({cat_id})...")
        from backend.scraper.ml_api.search import search_products_by_category
        try:
            saved = search_products_by_category(cat_id, max_items=200)
            print(f"    Saved {len(saved)} products")
        except Exception as e:
            print(f"    Error: {e}")

    db.close()
    print("Incremental update complete.")
