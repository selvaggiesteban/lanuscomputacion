"""Rename product images with SEO-optimized filenames and add alt text."""


def rename_all_images():
    from backend.db.database import CatalogDB
    from pathlib import Path
    import re

    db = CatalogDB()
    db.initialize()

    pending = db.conn.execute("""
        SELECT pi.id, pi.product_id, pi.file_path, pi.sort_order, p.title as product_title
        FROM product_images pi
        JOIN products p ON pi.product_id = p.id
        WHERE pi.file_path IS NOT NULL
    """).fetchall()

    print(f"Renaming {len(pending)} images with SEO filenames...")
    for i, img in enumerate(pending):
        d = dict(img)
        src = Path(d["file_path"])
        if not src.exists():
            continue

        title = d.get("product_title", "product")
        slug = _slugify(title)
        order = d.get("sort_order", 0)
        new_name = f"{slug}-{order}.webp" if order > 0 else f"{slug}.webp"

        new_path = src.parent / new_name
        try:
            src.rename(new_path)
            alt_text = f"Imagen de {title}"
            db.conn.execute(
                "UPDATE product_images SET file_path = ?, filename = ?, alt_text = ? WHERE id = ?",
                (str(new_path), new_name, alt_text, d["id"])
            )
            db.conn.commit()
        except Exception as e:
            print(f"  Error renaming {src.name}: {e}")

    print(f"  Done.")
    db.close()


def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text[:200]
