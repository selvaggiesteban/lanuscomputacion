"""Product review workflow management."""


def list_pending():
    from backend.db.database import CatalogDB

    db = CatalogDB()
    db.initialize()

    pending = db.conn.execute("""
        SELECT p.id, p.title, p.price, c.name as category, p.created_at, p.status
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status IN ('draft', 'pending_review')
        ORDER BY p.created_at DESC
    """).fetchall()

    print(f"\nProducts pending review: {len(pending)}\n")
    for p in pending:
        d = dict(p)
        print(f"  [{d['status']}] {d['id']} | {d['title'][:60]:60s} | ${d['price']} | {d.get('category', '')[:20]}")

    if not pending:
        print("  No products pending review.")

    db.close()


def apply_review_file(file_path: str):
    import csv
    from backend.db.database import CatalogDB

    db = CatalogDB()
    db.initialize()

    approved = 0
    rejected = 0

    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            product_id = row.get("id", "").strip()
            status = row.get("status", "").strip().lower()
            if product_id and status in ("published", "rejected"):
                db.set_product_status(product_id, status)
                if status == "published":
                    approved += 1
                else:
                    rejected += 1

    print(f"Approved: {approved}, Rejected: {rejected}")
    db.close()
