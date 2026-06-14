"""Download product images from MercadoLibre."""


def download_all_images(limit: int = 0):
    from backend.db.database import CatalogDB
    import requests
    from pathlib import Path

    db = CatalogDB()
    db.initialize()

    images_dir = Path(__file__).resolve().parent.parent.parent / "data" / "images"
    images_dir.mkdir(parents=True, exist_ok=True)

    pending = db.conn.execute("""
        SELECT pi.*, p.slug, p.category_id
        FROM product_images pi
        JOIN products p ON pi.product_id = p.id
        WHERE pi.file_path IS NULL
        ORDER BY pi.id
    """).fetchall()

    if limit > 0:
        pending = pending[:limit]

    print(f"Downloading {len(pending)} images...")
    for i, img in enumerate(pending):
        d = dict(img)
        url = d["url_original"].replace("http://", "https://")
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                ext = url.split(".")[-1].split("?")[0] or "jpg"
                cat_dir = images_dir / (d.get("category_id") or "unknown")
                prod_dir = cat_dir / d["product_id"]
                prod_dir.mkdir(parents=True, exist_ok=True)
                file_path = prod_dir / f"{d['sort_order']}.{ext}"
                file_path.write_bytes(resp.content)
                db.conn.execute(
                    "UPDATE product_images SET file_path = ? WHERE id = ?",
                    (str(file_path), d["id"])
                )
                db.conn.commit()
                print(f"  [{i+1}/{len(pending)}] Downloaded {url[:60]}...")
        except Exception as e:
            print(f"  [{i+1}/{len(pending)}] Error: {e}")

    db.close()
