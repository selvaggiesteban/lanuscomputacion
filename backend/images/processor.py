"""Convert downloaded images to WebP format."""


def process_all_images():
    from backend.db.database import CatalogDB
    from pathlib import Path
    from PIL import Image

    db = CatalogDB()
    db.initialize()

    pending = db.conn.execute("""
        SELECT * FROM product_images
        WHERE file_path IS NOT NULL
        AND (filename IS NULL OR NOT filename LIKE '%.webp')
    """).fetchall()

    print(f"Converting {len(pending)} images to WebP...")
    for i, img in enumerate(pending):
        d = dict(img)
        src = Path(d["file_path"])
        if not src.exists():
            continue
        webp_path = src.with_suffix(".webp")
        try:
            with Image.open(src) as im:
                im.save(webp_path, "WEBP", quality=85)
            db.conn.execute(
                "UPDATE product_images SET file_path = ?, filename = ? WHERE id = ?",
                (str(webp_path), webp_path.name, d["id"])
            )
            db.conn.commit()
            # Remove original
            if src.suffix.lower() not in (".webp",):
                src.unlink(missing_ok=True)
        except Exception as e:
            print(f"  Error converting {src.name}: {e}")

    print(f"  Done.")
    db.close()
