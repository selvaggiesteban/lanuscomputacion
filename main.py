#!/usr/bin/env python3
"""
StarTech - E-commerce B2B/B2C Catalog CLI

Usage:
    python main.py init                    Initialize database
    python main.py test-elit               Test ELIT API connection
    python main.py import-elit             Import all ELIT products
    python main.py import-elit --limit 50  Import first 50 ELIT products
    python main.py sync-elit               Sync ELIT (incremental, last 24h)
    python main.py export --format json    Export to JSON for frontend
    python main.py review list             List pending review
    python main.py serve                   Start API server
    python main.py export-frontend         Export DB to frontend JSON files
"""

import sys
import argparse
from datetime import datetime
from pathlib import Path


def cmd_init():
    from backend.db.database import CatalogDB
    db = CatalogDB()
    db.initialize()
    print(f"Database initialized at {db.db_path}")
    db.close()


def cmd_export(args):
    from backend.export.to_csv import export_to_csv
    from backend.export.to_json import export_to_json

    if args.format == "csv":
        export_to_csv(include_pending=(args.include_pending or "yes").lower() == "yes")
    elif args.format == "json":
        export_to_json(include_pending=(args.include_pending or "yes").lower() == "yes")
    else:
        print(f"Unknown format: {args.format}")


def cmd_review(args):
    from backend.workflow.review_queue import list_pending, apply_review_file

    if args.action == "list":
        list_pending()
    elif args.action == "apply":
        apply_review_file(args.file)
    else:
        print(f"Unknown action: {args.action}")


def cmd_serve():
    import uvicorn
    from backend.api.server import app
    print("Starting StarTech API server...")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)


def cmd_b2b(args):
    from backend.db.database import CatalogDB
    from backend.config.b2b_rules import calculate_all_b2b_prices
    db = CatalogDB()
    db.initialize()
    if args.b2b_action == "calc":
        calculate_all_b2b_prices(db)
    db.close()


def cmd_test_elit():
    from backend.scraper.elit_api.client import ElitClient
    print("Testing ELIT API connection...")
    client = ElitClient()
    if client.test_connection():
        print("OK: ELIT API connection successful")
        products = client.get_products(limit=3)
        for p in products[:3]:
            print(f"  - {p.get('nombre', 'N/A')} (id={p.get('id')}, moneda={p.get('moneda')}, precio={p.get('precio')})")
    else:
        print("ERROR: Could not connect to ELIT API")


def cmd_import_elit(args):
    from backend.db.database import CatalogDB
    from backend.scraper.elit_api.products import sync_elit_to_db
    db = CatalogDB()
    db.initialize()
    max_p = args.limit if args.limit else None
    result = sync_elit_to_db(db, max_products=max_p)
    total = db.count_products(provider="elit")
    print(f"\nImport complete. Total ELIT products in DB: {total}")
    db.close()


def cmd_sync_elit():
    from backend.db.database import CatalogDB
    from backend.scraper.elit_api.client import ElitClient
    from backend.scraper.elit_api.products import normalize_elit_product
    from datetime import datetime, timedelta

    db = CatalogDB()
    db.initialize()
    client = ElitClient()

    since = (datetime.utcnow() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M")
    print(f"Syncing ELIT products updated since {since}...")
    raw = client.get_products(limit=100, offset=0, actualizacion=since)

    inserted = 0
    updated = 0
    for p in raw:
        try:
            product = normalize_elit_product(p)
            existing = db.get_product_by_external_id(product["external_id"], "elit")
            if existing:
                db.update_product(existing["id"], product)
                updated += 1
            else:
                db.insert_product(product)
                inserted += 1
        except Exception as e:
            print(f"  Error with product {p.get('id', '?')}: {e}")

    print(f"Sync complete: {inserted} new, {updated} updated, {len(raw)} total from API")
    db.close()


def cmd_export_frontend(args):
    from backend.db.database import CatalogDB
    import json
    from pathlib import Path

    db = CatalogDB()
    db.initialize()

    products = db.export_products_for_frontend(status="published")
    frontend_data = Path("frontend/src/data")
    frontend_data.mkdir(parents=True, exist_ok=True)

    out_file = frontend_data / "products.json"
    out_file.write_text(json.dumps(products, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Exported {len(products)} published products to {out_file}")

    categories = db.get_all_categories()
    cat_file = frontend_data / "categories.json"
    cat_file.write_text(json.dumps(categories, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Exported {len(categories)} categories to {cat_file}")

    per_product_dir = frontend_data / "products"
    per_product_dir.mkdir(exist_ok=True)
    for p in products:
        pf = per_product_dir / f"{p['slug']}.json"
        pf.write_text(json.dumps(p, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Exported {len(products)} individual product files")

    db.close()


def main():
    parser = argparse.ArgumentParser(description="StarTech E-commerce Catalog")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    sub = parser.add_subparsers(dest="command")

    sub.add_parser("init", help="Initialize database")

    export_p = sub.add_parser("export", help="Export catalog")
    export_p.add_argument("--format", choices=["csv", "json"], default="csv")
    export_p.add_argument("--include-pending", choices=["yes", "no"], default="yes")

    review_p = sub.add_parser("review", help="Manage product review queue")
    review_p.add_argument("action", choices=["list", "apply"])
    review_p.add_argument("--file", "-f", help="CSV file with review decisions")

    b2b_p = sub.add_parser("b2b", help="B2B pricing")
    b2b_p.add_argument("b2b_action", choices=["calc"])

    serve_p = sub.add_parser("serve", help="Start FastAPI server")
    serve_p.add_argument("--port", type=int, default=8000)
    serve_p.add_argument("--host", default="0.0.0.0")

    sub.add_parser("test-elit", help="Test ELIT API connection")

    elit_p = sub.add_parser("import-elit", help="Import ELIT products to DB")
    elit_p.add_argument("--limit", type=int, default=0, help="Max products to import (0=all)")

    sub.add_parser("sync-elit", help="Sync ELIT products (incremental, last 24h)")

    sub.add_parser("export-frontend", help="Export DB to frontend JSON files")

    args = parser.parse_args()

    if args.command == "init":
        cmd_init()
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "review":
        cmd_review(args)
    elif args.command == "b2b":
        cmd_b2b(args)
    elif args.command == "serve":
        cmd_serve()
    elif args.command == "test-elit":
        cmd_test_elit()
    elif args.command == "import-elit":
        cmd_import_elit(args)
    elif args.command == "sync-elit":
        cmd_sync_elit()
    elif args.command == "export-frontend":
        cmd_export_frontend(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
