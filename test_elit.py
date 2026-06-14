import sys, json
sys.path.insert(0, '.')
from backend.scraper.elit_api.client import ElitClient

client = ElitClient()
print("Testing ELIT API...")
products = client.get_products(limit=5, offset=1)
print(f"Got {len(products)} products")
if not products:
    print("Trying raw request...")
    import requests
    resp = requests.post(
        "https://clientes.elit.com.ar/v1/api/productos",
        json={"user_id": 31341, "token": "7tmmibk2olt"},
        params={"limit": 5, "offset": 1},
        timeout=30,
    )
    print(f"Status: {resp.status_code}")
    print(f"Body: {resp.text[:1000]}")
else:
    for p in products[:3]:
        print(f"  ID: {p.get('id')}")
        print(f"  Nombre: {p.get('nombre')}")
        print(f"  Moneda: {p.get('moneda')}")
        print(f"  Precio: {p.get('precio')}")
        print(f"  Stock: {p.get('stock_total')}")
        print()
