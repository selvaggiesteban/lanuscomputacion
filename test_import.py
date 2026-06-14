import sys
sys.path.insert(0, '.')
from backend.db.database import CatalogDB
from backend.scraper.elit_api.products import fetch_elit_products_in_stock

db = CatalogDB()
db.initialize()

print("Fetching ELIT products (all, to count)...")
all_products = fetch_elit_products_in_stock()
print(f"Total products with stock > 0: {len(all_products)}")

print("\nImporting first 50 to DB...")
inserted = 0
for product in all_products[:50]:
    try:
        existing = db.get_product_by_external_id(product["external_id"], "elit")
        if not existing:
            db.insert_product(product)
            inserted += 1
            if inserted % 10 == 0:
                print(f"  Inserted {inserted}...")
    except Exception as e:
        print(f"  Error: {e}")

total = db.count_products(provider="elit")
print(f"\nDone. Inserted: {inserted}, Total in DB: {total}")
db.close()
