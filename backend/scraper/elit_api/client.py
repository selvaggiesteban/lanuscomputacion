"""
Cliente HTTP para la API de ELIT.
POST https://clientes.elit.com.ar/v1/api/productos
Auth: JSON body con user_id + token
"""
import time
import requests
from backend.config.suppliers import ELIT_CONFIG


class ElitClient:
    def __init__(self, config=None):
        self.config = config or ELIT_CONFIG
        self.base_url = self.config["api_url"]
        self.user_id = self.config["user_id"]
        self.token = self.config["token"]
        self.session = requests.Session()
        self.last_request = 0
        self.min_interval = 1.0 / self.config.get("rate_limit", 2)

    def _throttle(self):
        elapsed = time.time() - self.last_request
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)
        self.last_request = time.time()

    def _auth_body(self):
        return {"user_id": self.user_id, "token": self.token}

    def get_products(self, limit=100, offset=1, **filters) -> list:
        self._throttle()
        params = {"limit": min(limit, 100), "offset": max(offset, 1)}
        for key in ["id", "codigo_alfa", "codigo_producto", "nombre", "marca", "actualizacion"]:
            if key in filters and filters[key]:
                params[key] = filters[key]

        try:
            resp = self.session.post(
                self.base_url,
                json=self._auth_body(),
                params=params,
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict):
                return data.get("resultado", data.get("productos", data.get("data", [])))
            return data if isinstance(data, list) else []
        except requests.exceptions.HTTPError as e:
            print(f"[ELIT] HTTP Error {e.response.status_code}: {e.response.text[:200]}")
            return []
        except Exception as e:
            print(f"[ELIT] Error: {e}")
            return []

    def get_all_products(self, max_products=None) -> list:
        all_products = []
        offset = 1
        limit = 100

        while True:
            batch = self.get_products(limit=limit, offset=offset)
            if not batch:
                break
            all_products.extend(batch)
            print(f"[ELIT] Fetch offset={offset}, got {len(batch)} products (total: {len(all_products)})")
            if max_products and len(all_products) >= max_products:
                break
            if len(batch) < limit:
                break
            offset += limit

        return all_products

    def get_csv_url(self) -> str:
        return f"{self.config['csv_url']}?user_id={self.user_id}&token={self.token}"

    def get_meta_url(self) -> str:
        return f"{self.config['meta_url']}?user_id={self.user_id}&token={self.token}"

    def test_connection(self) -> bool:
        products = self.get_products(limit=1)
        return len(products) > 0
