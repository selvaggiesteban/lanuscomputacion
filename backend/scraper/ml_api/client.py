"""
MercadoLibre API client with optional OAuth authentication.
Categories API works without auth.
Search and Items require auth (access token).
"""

import os
import time
import requests
from backend.config.settings import ML_API_BASE, ML_RATE_LIMIT
from backend.scraper.ml_api.auth import MLAuth


class MLClient:
    def __init__(self, use_auth: bool = False):
        self.base_url = ML_API_BASE
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json",
        })
        self._last_request = 0.0
        self._min_interval = 1.0 / ML_RATE_LIMIT
        self.stats = {"requests": 0, "errors": 0}
        self.use_auth = use_auth
        self.auth = None

        if use_auth:
            self.auth = MLAuth(
                client_id=os.getenv("ML_CLIENT_ID", ""),
                client_secret=os.getenv("ML_CLIENT_SECRET", ""),
            )
            if self.auth.has_token():
                self.session.headers.update({
                    "Authorization": f"Bearer {self.auth.get_access_token()}"
                })

    def _rate_limit(self):
        elapsed = time.time() - self._last_request
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_request = time.time()

    def _update_auth_header(self):
        if self.auth and self.auth.has_token():
            token = self.auth.get_access_token()
            self.session.headers.update({"Authorization": f"Bearer {token}"})

    def _request(self, method: str, path: str, params: dict = None) -> dict:
        self._rate_limit()
        if self.use_auth:
            self._update_auth_header()
        url = f"{self.base_url}{path}"
        try:
            resp = self.session.request(method, url, params=params, timeout=30)
            self.stats["requests"] += 1
            if resp.status_code == 401 and self.use_auth:
                print("  Token expired, refreshing...")
                self._update_auth_header()
                resp = self.session.request(method, url, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.HTTPError as e:
            self.stats["errors"] += 1
            if resp.status_code == 403:
                msg = resp.json().get("message", "")
                if "forbidden" in msg.lower() and not self.use_auth:
                    raise Exception(
                        "ML API search requires authentication. "
                        "Register at https://developers.mercadolibre.com/ "
                        "and set ML_CLIENT_ID and ML_CLIENT_SECRET env vars."
                    ) from e
            raise Exception(f"ML API error ({resp.status_code}): {resp.text[:200]}") from e
        except requests.exceptions.RequestException as e:
            self.stats["errors"] += 1
            raise Exception(f"ML API error: {e}") from e

    def get(self, path: str, params: dict = None) -> dict:
        return self._request("GET", path, params)

    def search(self, category_id: str, limit: int = 50, offset: int = 0, sort: str = None) -> dict:
        if not self.use_auth:
            self._ensure_auth()
        params = {
            "category": category_id,
            "limit": min(limit, 50),
            "offset": offset,
        }
        if sort:
            params["sort"] = sort  # "price_asc", "price_desc", "start_time"
        return self.get("/sites/MLA/search", params)

    def search_all_pages(self, category_id: str, max_items: int = 1000) -> list:
        items = []
        offset = 0
        limit = 50
        while offset < max_items:
            data = self.search(category_id, limit=limit, offset=offset)
            results = data.get("results", [])
            if not results:
                break
            items.extend(results)
            offset += limit
            total = data.get("paging", {}).get("total", 0)
            if offset >= total or offset >= max_items:
                break
        return items

    def search_by_query(self, query: str, category_id: str = None, limit: int = 50, sort: str = None) -> dict:
        if not self.use_auth:
            self._ensure_auth()
        params = {"q": query, "limit": min(limit, 50)}
        if category_id:
            params["category"] = category_id
        if sort:
            params["sort"] = sort
        return self.get("/sites/MLA/search", params)

    def get_item(self, item_id: str) -> dict:
        if not self.use_auth:
            self._ensure_auth()
        return self.get(f"/items/{item_id}")

    def get_item_description(self, item_id: str) -> str:
        if not self.use_auth:
            self._ensure_auth()
        data = self.get(f"/items/{item_id}/description")
        return data.get("text", "")

    # ── Public endpoints (no auth needed) ──

    def get_category(self, category_id: str) -> dict:
        return self.get(f"/categories/{category_id}")

    def get_site_categories(self) -> list:
        return self.get("/sites/MLA/categories")

    def domain_discovery(self, query: str, limit: int = 1) -> list:
        return self.get("/sites/MLA/domain_discovery/search", {"q": query, "limit": limit})

    def _ensure_auth(self):
        if not self.auth:
            self.auth = MLAuth(
                client_id=os.getenv("ML_CLIENT_ID", ""),
                client_secret=os.getenv("ML_CLIENT_SECRET", ""),
            )
        if not self.auth.has_token():
            MLAuth.print_instructions()
            raise Exception("ML API authentication required for this endpoint.")
        self.use_auth = True
        self._update_auth_header()

    def close(self):
        self.session.close()
