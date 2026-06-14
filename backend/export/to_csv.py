"""Export catalog to CSV files."""


def export_to_csv(include_pending: bool = True):
    from backend.db.database import CatalogDB
    from pathlib import Path
    import csv

    db = CatalogDB()
    db.initialize()

    exports_dir = Path(__file__).resolve().parent.parent.parent / "data" / "exports"
    exports_dir.mkdir(parents=True, exist_ok=True)

    # Export published products
    rows = db.conn.execute("""
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'published'
        ORDER BY c.name, p.title
    """).fetchall()

    pub_path = exports_dir / "published_catalog.csv"
    with open(pub_path, "w", newline="", encoding="utf-8-sig") as f:
        if rows:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows([dict(r) for r in rows])
    print(f"Published: {len(rows)} products -> {pub_path}")

    # Export pending review
    if include_pending:
        pending = db.conn.execute("""
            SELECT p.*, c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.status IN ('draft', 'pending_review')
            ORDER BY p.created_at DESC
        """).fetchall()

        pend_path = exports_dir / "pending_review.csv"
        with open(pend_path, "w", newline="", encoding="utf-8-sig") as f:
            if pending:
                writer = csv.DictWriter(f, fieldnames=pending[0].keys())
                writer.writeheader()
                writer.writerows([dict(r) for r in pending])
        print(f"Pending review: {len(pending)} products -> {pend_path}")

    db.close()
