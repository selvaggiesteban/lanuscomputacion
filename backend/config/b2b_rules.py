"""B2B pricing rules configuration."""

B2B_RULES = {
    "default": {"discount": 0.10, "min_qty": 6},
    "Celulares y Smartphones": {"discount": 0.08, "min_qty": 3},
    "Componentes de PC": {"discount": 0.15, "min_qty": 10},
    "Almacenamiento": {"discount": 0.12, "min_qty": 5},
    "Notebooks": {"discount": 0.08, "min_qty": 3},
    "Monitores": {"discount": 0.10, "min_qty": 5},
    "Impresión": {"discount": 0.10, "min_qty": 5},
    "Audio": {"discount": 0.12, "min_qty": 6},
    "Consolas": {"discount": 0.05, "min_qty": 3},
    "Videojuegos": {"discount": 0.10, "min_qty": 3},
    "Periféricos de PC": {"discount": 0.12, "min_qty": 10},
    "Accesorios para Celulares": {"discount": 0.15, "min_qty": 12},
}


def get_b2b_rule(category_name: str) -> dict:
    """Get B2B pricing rule for a category, falling back to default."""
    for key, rule in B2B_RULES.items():
        if key.lower() in category_name.lower():
            return rule
    return B2B_RULES["default"]


def calculate_all_b2b_prices(db):
    """Calculate B2B prices for all published products."""
    from backend.db.database import CatalogDB

    products = db.conn.execute("""
        SELECT p.id, p.price, p.title, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.status = 'published' AND p.price IS NOT NULL
    """).fetchall()

    print(f"Calculating B2B prices for {len(products)} products...")
    for p in products:
        d = dict(p)
        base_price = d["price"]
        rule = get_b2b_rule(d.get("category_name", ""))
        discount = rule["discount"]
        min_qty = rule["min_qty"]
        final_price = round(base_price * (1 - discount), 2)

        db.upsert_b2b_price({
            "product_id": d["id"],
            "base_price": base_price,
            "discount_pct": discount,
            "discount_rule": d.get("category_name", "default"),
            "final_price": final_price,
            "min_quantity": min_qty,
        })

    print(f"  Done.")
