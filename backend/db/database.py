import sqlite3
import json
from datetime import datetime
from pathlib import Path
from slugify import slugify
from backend.config.settings import DB_PATH, DATA_DIR


class CatalogDB:
    def __init__(self, db_path: Path = None):
        self.db_path = db_path or DB_PATH
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")

    def initialize(self):
        schema_path = Path(__file__).parent / "schema.sql"
        schema = schema_path.read_text(encoding="utf-8")
        self.conn.executescript(schema)
        self.conn.commit()

    def close(self):
        self.conn.close()

    # ── Categories ──

    def upsert_category(self, cat: dict):
        self.conn.execute("""
            INSERT INTO categories (id, name, slug, parent_id, level, total_items, picture, permalink, last_api_update)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name, slug=excluded.slug, parent_id=excluded.parent_id,
                level=excluded.level, total_items=excluded.total_items,
                picture=excluded.picture, permalink=excluded.permalink, last_api_update=excluded.last_api_update
        """, (
            cat["id"], cat["name"], cat.get("slug", self._slugify(cat["name"])),
            cat.get("parent_id"), cat.get("level", 0), cat.get("total_items", 0),
            cat.get("picture"), cat.get("permalink"), datetime.utcnow().isoformat()
        ))
        self.conn.commit()

    def get_category(self, category_id: str) -> dict:
        row = self.conn.execute("SELECT * FROM categories WHERE id = ?", (category_id,)).fetchone()
        return dict(row) if row else None

    def get_subcategories(self, parent_id: str) -> list:
        rows = self.conn.execute(
            "SELECT * FROM categories WHERE parent_id = ? ORDER BY priority, name", (parent_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    def get_all_categories(self) -> list:
        rows = self.conn.execute("SELECT * FROM categories ORDER BY level, name").fetchall()
        return [dict(r) for r in rows]

    # ── Products ──

    def upsert_product(self, prod: dict):
        self.conn.execute("""
            INSERT INTO products (id, title, slug, description, category_id, status,
                price, original_price, currency, condition, available_qty, sold_qty,
                rating, reviews_count, seller_id, seller_nickname, seller_reputation,
                free_shipping, listing_type, permalink, thumbnail, last_api_update)
            VALUES (?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title, slug=excluded.slug, description=excluded.description,
                price=excluded.price, original_price=excluded.original_price,
                condition=excluded.condition, available_qty=excluded.available_qty,
                sold_qty=excluded.sold_qty, rating=excluded.rating,
                reviews_count=excluded.reviews_count, free_shipping=excluded.free_shipping,
                last_api_update=excluded.last_api_update
        """, (
            prod["id"], prod["title"], prod.get("slug", self._slugify(prod["title"])),
            prod.get("description"), prod["category_id"], prod.get("status", "draft"),
            prod.get("price"), prod.get("original_price"), prod.get("currency", "ARS"),
            prod.get("condition", "new"), prod.get("available_qty", 0), prod.get("sold_qty", 0),
            prod.get("rating", 0.0), prod.get("reviews_count", 0),
            prod.get("seller_id"), prod.get("seller_nickname"), prod.get("seller_reputation"),
            1 if prod.get("free_shipping") else 0,
            prod.get("listing_type"), prod.get("permalink"), prod.get("thumbnail"),
            datetime.utcnow().isoformat()
        ))
        self.conn.commit()

    def get_product(self, product_id: str) -> dict:
        row = self.conn.execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
        return dict(row) if row else None

    def get_products_by_category(self, category_id: str, status: str = None, limit: int = 50, offset: int = 0) -> list:
        sql = "SELECT * FROM products WHERE category_id = ?"
        params = [category_id]
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = self.conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]

    def count_products_by_category(self, category_id: str, status: str = None) -> int:
        sql = "SELECT COUNT(*) as cnt FROM products WHERE category_id = ?"
        params = [category_id]
        if status:
            sql += " AND status = ?"
            params.append(status)
        row = self.conn.execute(sql, params).fetchone()
        return row["cnt"] if row else 0

    def set_product_status(self, product_id: str, status: str):
        now = datetime.utcnow().isoformat()
        extra = ""
        if status == "published":
            extra = ", published_at = ?"
        elif status == "rejected":
            extra = ", reviewed_at = ?"
        self.conn.execute(
            f"UPDATE products SET status = ?, reviewed_at = ?{extra} WHERE id = ?",
            (status, now, now, product_id)
        )
        self.conn.commit()

    def get_products_pending_review(self) -> list:
        rows = self.conn.execute(
            "SELECT * FROM products WHERE status IN ('draft', 'pending_review') ORDER BY created_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]

    # ── Product Images ──

    def upsert_product_image(self, img: dict):
        self.conn.execute("""
            INSERT INTO product_images (product_id, url_original, file_path, filename, alt_text, width, height, file_size_bytes, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING
        """, (
            img["product_id"], img["url_original"], img.get("file_path"),
            img.get("filename"), img.get("alt_text"), img.get("width"),
            img.get("height"), img.get("file_size_bytes"), img.get("sort_order", 0)
        ))
        self.conn.commit()

    def get_product_images(self, product_id: str) -> list:
        rows = self.conn.execute(
            "SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order", (product_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    # ── Attributes ──

    def upsert_product_attributes(self, product_id: str, attributes: list):
        self.conn.execute("DELETE FROM product_attributes WHERE product_id = ?", (product_id,))
        for attr in attributes:
            self.conn.execute("""
                INSERT INTO product_attributes (product_id, name, value, value_id, attribute_group)
                VALUES (?, ?, ?, ?, ?)
            """, (
                product_id, attr.get("name", ""), attr.get("value", ""),
                attr.get("value_id"), attr.get("attribute_group")
            ))
        self.conn.commit()

    def get_product_attributes(self, product_id: str) -> list:
        rows = self.conn.execute(
            "SELECT * FROM product_attributes WHERE product_id = ?", (product_id,)
        ).fetchall()
        return [dict(r) for r in rows]

    # ── B2B Pricing ──

    def upsert_b2b_price(self, data: dict):
        self.conn.execute("""
            INSERT INTO b2b_prices (product_id, base_price, discount_pct, discount_rule, final_price, min_quantity, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(product_id) DO UPDATE SET
                discount_pct=excluded.discount_pct, discount_rule=excluded.discount_rule,
                final_price=excluded.final_price, min_quantity=excluded.min_quantity,
                updated_at=excluded.updated_at
        """, (
            data["product_id"], data["base_price"], data["discount_pct"],
            data.get("discount_rule"), data["final_price"], data.get("min_quantity", 1),
            datetime.utcnow().isoformat()
        ))
        self.conn.commit()

    def get_b2b_price(self, product_id: str) -> dict:
        row = self.conn.execute("SELECT * FROM b2b_prices WHERE product_id = ?", (product_id,)).fetchone()
        return dict(row) if row else None

    # ── Sync Checkpoints ──

    def upsert_checkpoint(self, cp: dict):
        self.conn.execute("""
            INSERT INTO sync_checkpoint (category_id, page, status, items_total, items_scraped, error_message, started_at, completed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(category_id, page) DO UPDATE SET
                status=excluded.status, items_scraped=excluded.items_scraped,
                error_message=excluded.error_message, completed_at=excluded.completed_at
        """, (
            cp["category_id"], cp.get("page", 0), cp.get("status", "pending"),
            cp.get("items_total", 0), cp.get("items_scraped", 0),
            cp.get("error_message"), cp.get("started_at"), cp.get("completed_at")
        ))
        self.conn.commit()

    def get_checkpoint(self, category_id: str, page: int = 0) -> dict:
        row = self.conn.execute(
            "SELECT * FROM sync_checkpoint WHERE category_id = ? AND page = ?",
            (category_id, page)
        ).fetchone()
        return dict(row) if row else None

    # ── Customers ──

    def upsert_customer(self, cust: dict) -> int:
        cur = self.conn.execute("""
            INSERT INTO customers (email, password_hash, name, phone, google_id, facebook_id, is_b2b)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET
                name=excluded.name, phone=excluded.phone, last_login=CURRENT_TIMESTAMP
        """, (
            cust["email"], cust.get("password_hash"), cust.get("name"),
            cust.get("phone"), cust.get("google_id"), cust.get("facebook_id"),
            1 if cust.get("is_b2b") else 0
        ))
        self.conn.commit()
        return cur.lastrowid

    def get_customer_by_email(self, email: str) -> dict:
        row = self.conn.execute("SELECT * FROM customers WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None

    # ── Orders ──

    def insert_order(self, order: dict):
        self.conn.execute("""
            INSERT INTO orders (id, customer_id, product_id, quantity, unit_price, total_price,
                payment_method, customer_name, customer_email, customer_phone, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            order["id"], order.get("customer_id"), order["product_id"],
            order.get("quantity", 1), order["unit_price"], order["total_price"],
            order["payment_method"], order.get("customer_name"), order.get("customer_email"),
            order.get("customer_phone"), order.get("notes")
        ))
        self.conn.commit()

    def update_order_payment(self, order_id: str, payment_status: str, mp_payment_id: str = None):
        now = datetime.utcnow().isoformat()
        self.conn.execute(
            "UPDATE orders SET payment_status=?, mp_payment_id=?, paid_at=? WHERE id=?",
            (payment_status, mp_payment_id, now, order_id)
        )
        self.conn.commit()

    # ── Favorites ──

    def add_favorite(self, customer_id: int, product_id: str):
        self.conn.execute(
            "INSERT OR IGNORE INTO favorites (customer_id, product_id) VALUES (?, ?)",
            (customer_id, product_id)
        )
        self.conn.commit()

    def remove_favorite(self, customer_id: int, product_id: str):
        self.conn.execute(
            "DELETE FROM favorites WHERE customer_id = ? AND product_id = ?",
            (customer_id, product_id)
        )
        self.conn.commit()

    def get_favorites(self, customer_id: int) -> list:
        rows = self.conn.execute("""
            SELECT p.* FROM products p
            JOIN favorites f ON p.id = f.product_id
            WHERE f.customer_id = ?
        """, (customer_id,)).fetchall()
        return [dict(r) for r in rows]

    # ── Notifications ──

    def add_notification(self, notif: dict):
        self.conn.execute("""
            INSERT INTO notifications (customer_id, type, title, message)
            VALUES (?, ?, ?, ?)
        """, (notif["customer_id"], notif["type"], notif["title"], notif.get("message")))
        self.conn.commit()

    def get_notifications(self, customer_id: int, unread_only: bool = False) -> list:
        sql = "SELECT * FROM notifications WHERE customer_id = ?"
        params = [customer_id]
        if unread_only:
            sql += " AND is_read = 0"
        sql += " ORDER BY created_at DESC"
        rows = self.conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]

    # ── Config ──

    def get_config(self, key: str, default=None):
        row = self.conn.execute("SELECT value FROM app_config WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else default

    def set_config(self, key: str, value: str):
        self.conn.execute("""
            INSERT INTO app_config (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
        """, (key, value, datetime.utcnow().isoformat()))
        self.conn.commit()

    # ── Generic Products (ELIT, Distecna, etc.) ──

    def get_product_by_external_id(self, external_id: str, provider: str) -> dict:
        row = self.conn.execute(
            "SELECT * FROM products WHERE external_id = ? AND provider = ?",
            (external_id, provider)
        ).fetchone()
        return dict(row) if row else None

    def insert_product(self, product: dict):
        self.conn.execute("""
            INSERT INTO products (
                id, external_id, title, slug, description, category_id, category_name,
                subcategory_name, status, price, cost_price, original_price, currency,
                dollar_rate, iva_pct, internal_tax_pct, markup_pct, brand, sku,
                codigo_alfa, ean, weight, warranty, provider, provider_store,
                condition, available_qty, stock_level, sold_qty, rating, reviews_count,
                free_shipping, permalink, thumbnail, supplier_link, is_gamer,
                last_api_update, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            product["id"], product.get("external_id"), product["title"], product.get("slug"),
            product.get("description"), product.get("category_id", "uncategorized"),
            product.get("category_name"), product.get("subcategory_name"),
            product.get("status", "draft"), product.get("price"), product.get("cost_price"),
            product.get("original_price"), product.get("currency", "ARS"),
            product.get("dollar_rate"), product.get("iva_pct", 10.5),
            product.get("internal_tax_pct", 0), product.get("markup_pct", 23.0),
            product.get("brand"), product.get("sku"), product.get("codigo_alfa"),
            product.get("ean"), product.get("weight"), product.get("warranty"),
            product.get("provider", "manual"), product.get("provider_store", "minorista"),
            product.get("condition", "new"), product.get("available_qty", 0),
            product.get("stock_level"), product.get("sold_qty", 0),
            product.get("rating", 0.0), product.get("reviews_count", 0),
            1 if product.get("free_shipping") else 0,
            product.get("permalink"), product.get("thumbnail"),
            product.get("supplier_link"), 1 if product.get("is_gamer") else 0,
            datetime.utcnow().isoformat(), datetime.utcnow().isoformat()
        ))
        self.conn.commit()

    def update_product(self, product_id: str, data: dict):
        fields = []
        values = []
        for key in ["title", "slug", "description", "price", "cost_price", "currency",
                     "dollar_rate", "iva_pct", "internal_tax_pct", "markup_pct",
                     "available_qty", "stock_level", "thumbnail", "supplier_link",
                     "status", "last_api_update"]:
            if key in data:
                fields.append(f"{key} = ?")
                values.append(data[key])
        if not fields:
            return
        fields.append("last_api_update = ?")
        values.append(datetime.utcnow().isoformat())
        values.append(product_id)
        sql = f"UPDATE products SET {', '.join(fields)} WHERE id = ?"
        self.conn.execute(sql, values)
        self.conn.commit()

    def get_all_products(self, status: str = None, provider: str = None,
                         provider_store: str = None, limit: int = 100, offset: int = 0) -> list:
        sql = "SELECT * FROM products WHERE 1=1"
        params = []
        if status:
            sql += " AND status = ?"
            params.append(status)
        if provider:
            sql += " AND provider = ?"
            params.append(provider)
        if provider_store:
            sql += " AND provider_store = ?"
            params.append(provider_store)
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        rows = self.conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]

    def count_products(self, provider: str = None, status: str = None,
                       provider_store: str = None) -> int:
        sql = "SELECT COUNT(*) as cnt FROM products WHERE 1=1"
        params = []
        if provider:
            sql += " AND provider = ?"
            params.append(provider)
        if status:
            sql += " AND status = ?"
            params.append(status)
        if provider_store:
            sql += " AND provider_store = ?"
            params.append(provider_store)
        row = self.conn.execute(sql, params).fetchone()
        return row["cnt"] if row else 0

    def upsert_category_by_name(self, name: str, provider: str) -> str:
        import re
        slug = re.sub(r'[^\w\s-]', '', name.lower().strip())
        slug = re.sub(r'[-\s]+', '-', slug)
        cat_id = f"{provider}_{slug}"
        self.conn.execute("""
            INSERT OR IGNORE INTO categories (id, name, slug, level)
            VALUES (?, ?, ?, 0)
        """, (cat_id, name, slug))
        self.conn.commit()
        return cat_id

    # ── Export Helpers ──

    def export_products_for_frontend(self, status: str = "published",
                                     provider_store: str = None) -> list:
        sql = "SELECT * FROM products WHERE status = ?"
        params = [status]
        if provider_store:
            sql += " AND provider_store = ?"
            params.append(provider_store)
        sql += " ORDER BY created_at DESC"
        rows = self.conn.execute(sql, params).fetchall()
        result = []
        for row in rows:
            r = dict(row)
            cat_name = r.get("category_name") or ""
            subcat_name = r.get("subcategory_name") or ""
            price = r.get("price") or 0
            result.append({
                "id": r["id"],
                "title": r["title"],
                "price": price,
                "originalPrice": r.get("cost_price"),
                "discount": None,
                "image": r.get("thumbnail") or "https://via.placeholder.com/200",
                "slug": r["slug"],
                "categorySlug": slugify(cat_name) if cat_name else "",
                "category": cat_name,
                "subcategory": subcat_name,
                "brand": r.get("brand") or "",
                "sku": r.get("sku") or "",
                "ean": r.get("ean") or "",
                "warranty": r.get("warranty") or "",
                "description": r.get("description") or "",
                "rating": r.get("rating") or 0,
                "reviewsCount": r.get("reviews_count") or 0,
                "freeShipping": bool(r.get("free_shipping")),
                "installments": {"count": 6, "value": round(price / 6) if price else 0},
                "stock": r.get("available_qty") or 0,
                "provider": r.get("provider"),
                "providerStore": r.get("provider_store"),
                "isGamer": bool(r.get("is_gamer")),
                "dollarRate": r.get("dollar_rate"),
            })
        return result

    # ── Helpers ──

    @staticmethod
    def _slugify(text: str) -> str:
        import re
        text = text.lower().strip()
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[-\s]+', '-', text)
        return text[:200]
