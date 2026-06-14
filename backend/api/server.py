"""FastAPI server for StarTech."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="StarTech API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/categories")
def get_categories():
    from backend.db.database import CatalogDB
    db = CatalogDB()
    db.initialize()
    cats = db.conn.execute("SELECT * FROM categories ORDER BY level, name").fetchall()
    db.close()
    return [dict(c) for c in cats]


@app.get("/api/products")
def get_products(category: str = None, limit: int = 50, offset: int = 0, sort: str = None):
    from backend.db.database import CatalogDB
    db = CatalogDB()
    db.initialize()
    if category:
        sql = "SELECT * FROM products WHERE category_id = ? AND status = 'published'"
        params = [category]
    else:
        sql = "SELECT * FROM products WHERE status = 'published'"
        params = []
    if sort == "price_asc":
        sql += " ORDER BY price ASC"
    elif sort == "price_desc":
        sql += " ORDER BY price DESC"
    elif sort == "newest":
        sql += " ORDER BY created_at DESC"
    else:
        sql += " ORDER BY sold_qty DESC"
    sql += " LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    prods = db.conn.execute(sql, params).fetchall()
    db.close()
    return [dict(p) for p in prods]


@app.get("/api/products/{product_id}")
def get_product(product_id: str):
    from backend.db.database import CatalogDB
    db = CatalogDB()
    db.initialize()
    prod = db.get_product(product_id)
    if prod:
        images = db.get_product_images(product_id)
        attrs = db.get_product_attributes(product_id)
        b2b = db.get_b2b_price(product_id)
        prod["images"] = images
        prod["attributes"] = attrs
        prod["b2b_price"] = b2b
    db.close()
    return prod


@app.get("/api/search")
def search_products(q: str, category: str = None, limit: int = 50):
    from backend.db.database import CatalogDB
    db = CatalogDB()
    db.initialize()
    sql = "SELECT * FROM products WHERE status = 'published' AND (title LIKE ? OR id LIKE ?)"
    params = [f"%{q}%", f"%{q}%"]
    if category:
        sql += " AND category_id = ?"
        params.append(category)
    sql += " LIMIT ?"
    params.append(limit)
    prods = db.conn.execute(sql, params).fetchall()
    db.close()
    return [dict(p) for p in prods]
