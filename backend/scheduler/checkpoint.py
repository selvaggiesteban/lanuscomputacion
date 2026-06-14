"""Checkpoint management for resume capability."""


def save_checkpoint(category_id: str, page: int, status: str,
                    items_total: int = 0, items_scraped: int = 0,
                    error_message: str = None):
    from backend.db.database import CatalogDB
    from datetime import datetime

    db = CatalogDB()
    db.initialize()
    now = datetime.utcnow().isoformat()

    db.upsert_checkpoint({
        "category_id": category_id,
        "page": page,
        "status": status,
        "items_total": items_total,
        "items_scraped": items_scraped,
        "error_message": error_message,
        "started_at": now if status == "in_progress" else None,
        "completed_at": now if status == "completed" else None,
    })
    db.close()


def get_progress_summary() -> dict:
    """Get summary of all scrape progress."""
    from backend.db.database import CatalogDB

    db = CatalogDB()
    db.initialize()

    rows = db.conn.execute("""
        SELECT c.name, cp.status, cp.items_total, cp.items_scraped,
               cp.started_at, cp.completed_at, cp.error_message
        FROM sync_checkpoint cp
        JOIN categories c ON cp.category_id = c.id
        ORDER BY cp.started_at DESC
    """).fetchall()

    summary = {}
    for r in rows:
        d = dict(r)
        summary[d["name"]] = d

    db.close()
    return summary
