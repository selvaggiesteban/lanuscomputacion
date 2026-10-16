"""
Cloudflare Worker for Lanús Computación API
Using native Cloudflare Workers Python syntax.
"""
from js import Response, fetch

async def on_fetch(request, env):
    url = request.url
    path = url.split("/")[-2 if url.endswith("/") else -1]

    # Simple router
    if "/api/health" in url:
        return Response.new(json_response({"status": "ok"}))

    if "/api/categories" in url:
        return await handle_categories(env)

    if "/api/products" in url:
        return await handle_products(request, env)

    if "/api/products/" in url:
        return await handle_product_detail(url, env)

    if "/api/search" in url:
        return await handle_search(request, env)

    return Response.new("Not Found", status=404)

def json_response(data, status=200):
    import json
    return Response.new(
        json.dumps(data),
        status=status,
        headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
    )

async def handle_categories(env):
    from backend.db.database import CatalogDB
    db = CatalogDB(env.DB) # Pass D1 binding
    cats = db.get_all_categories()
    return json_response(cats)

async def handle_products(request, env):
    from backend.db.database import CatalogDB
    db = CatalogDB(env.DB)

    # Parse query params from URL
    import urllib.parse
    params = urllib.parse.parse_qs(url_params(request.url))

    category = params.get("category", [None])[0]
    limit = int(params.get("limit", [50])[0])
    offset = int(params.get("offset", [0])[0])
    sort = params.get("sort", [None])[0]

    prods = db.get_products_by_category(category, limit=limit, offset=offset) # Simplified for now
    return json_response(prods)

async def handle_product_detail(url, env):
    from backend.db.database import CatalogDB
    db = CatalogDB(env.DB)
    product_id = url.split("/")[-1]
    prod = db.get_product(product_id)
    return json_response(prod if prod else {"error": "Not found"}, 200 if prod else 404)

async def handle_search(request, env):
    from backend.db.database import CatalogDB
    db = CatalogDB(env.DB)
    import urllib.parse
    params = urllib.parse.parse_qs(url_params(request.url))
    q = params.get("q", [""])[0]

    prods = db.search_products(q)
    return json_//_response(prods)

def url_params(url):
    import urllib.parse
    parsed = urllib.parse.urlparse(url)
    return parsed.query
