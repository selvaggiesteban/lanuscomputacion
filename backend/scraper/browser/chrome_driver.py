"""
Playwright Chrome driver for MercadoLibre listing page scraping.
Used when the ML API search endpoint is not available (requires auth).
The public listing HTML pages are fully accessible.
"""

import json
import re
from typing import Optional
from datetime import datetime
from playwright.sync_api import sync_playwright, Page, Browser


class MLBrowserScraper:
    def __init__(self, headless: bool = True):
        self.headless = headless
        self._playwright = None
        self._browser: Optional[Browser] = None

    def start(self):
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
            ]
        )
        return self

    def stop(self):
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()

    def __enter__(self):
        return self.start()

    def __exit__(self, *args):
        self.stop()

    def _new_page(self) -> Page:
        context = self._browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="es-AR",
            timezone_id="America/Argentina/Buenos_Aires",
            geolocation={"latitude": -34.6037, "longitude": -58.3816},
            permissions=["geolocation"],
        )
        # Remove webdriver detection
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5]
            });
            Object.defineProperty(navigator, 'languages', {
                get: () => ['es-AR', 'es', 'en']
            });
        """)
        page = context.new_page()
        return page

    def search_category(self, category_slug: str, max_pages: int = 20, limit: int = 1000) -> list:
        """
        Scrape products from a MercadoLibre listing page.
        Category slug examples: "computacion", "celulares-telefonos/celulares-smartphones"
        """
        products = []
        page_num = 0

        while len(products) < limit and page_num < max_pages:
            page = self._new_page()
            try:
                if page_num == 0:
                    url = f"https://listado.mercadolibre.com.ar/{category_slug}/"
                else:
                    url = f"https://listado.mercadolibre.com.ar/{category_slug}/_Desde_{(page_num * 48) + 1}"

                page.goto(url, wait_until="networkidle", timeout=30000)
                page.wait_for_timeout(3000)

                # Wait for product cards to appear
                try:
                    page.wait_for_selector("li.ui-search-layout__item", timeout=10000)
                except Exception:
                    pass

                items = page.query_selector_all("li.ui-search-layout__item")
                if not items:
                    items = page.query_selector_all("[class*=ui-search-layout__item]")
                if not items:
                    items = page.query_selector_all("[data-testid*=item-card]")
                if not items:
                    items = page.query_selector_all("ol.ui-search-layout li")

                print(f"  Page {page_num + 1}: found {len(items)} items")
                for item in items:
                    try:
                        prod = self._extract_listing_product(item)
                        if prod and prod.get("id"):
                            products.append(prod)
                    except Exception:
                        continue

                page_num += 1

            except Exception as e:
                print(f"  Error on page {page_num}: {e}")
                break
            finally:
                page.close()

        return products[:limit]

    def _extract_listing_product(self, element) -> dict:
        """Extract product data from a listing card element."""

        def get_text(sel: str, default=""):
            try:
                el = element.query_selector(sel)
                return el.inner_text().strip() if el else default
            except Exception:
                return default

        def get_attr(sel: str, attr: str, default=""):
            try:
                el = element.query_selector(sel)
                return el.get_attribute(attr) or default if el else default
            except Exception:
                return default

        title = get_text("h2.ui-search-item__title") or get_text(".ui-search-item__title") or ""
        link = get_attr("a.ui-search-link", "href")
        img = get_attr("img.ui-search-result-image__element", "src") or get_attr("img", "data-src", "")

        price_text = get_text(".ui-search-price__second-line .andes-money-amount__fraction")
        orig_price_text = get_text(".ui-search-price__first-line .andes-money-amount__fraction")
        installments_text = get_text(".ui-search-installments")
        shipping_text = get_text(".ui-search-item__shipping")
        rating_text = get_text(".ui-search-reviews__rating")
        reviews_text = get_text(".ui-search-reviews__amount")

        item_id = ""
        if link:
            match = re.search(r'MLA-(\d+)', link)
            if match:
                item_id = f"MLA{match.group(1)}"

        price = self._parse_price(price_text)
        orig_price = self._parse_price(orig_price_text)

        return {
            "id": item_id,
            "title": title,
            "price": price,
            "original_price": orig_price if orig_price and orig_price > price else None,
            "currency": "ARS",
            "condition": "new",
            "free_shipping": "gratis" in shipping_text.lower() if shipping_text else False,
            "rating": self._parse_float(rating_text),
            "reviews_count": self._parse_int(reviews_text),
            "permalink": link,
            "thumbnail": img,
            "seller_nickname": "",
            "available_qty": 0,
            "sold_qty": 0,
            "listing_type": "",
        }

    def get_item_detail_url(self, item_id: str) -> str:
        full_url = None
        page = self._new_page()
        try:
            listing_url = f"https://www.mercadolibre.com.ar/p/{item_id.replace('MLA', '')}"
            page.goto(listing_url, wait_until="domcontentloaded", timeout=15000)
            page.wait_for_timeout(2000)
            full_url = page.url
        except Exception:
            pass
        finally:
            page.close()
        return full_url or f"https://www.mercadolibre.com.ar/items/{item_id}"

    @staticmethod
    def _parse_price(text: str) -> Optional[float]:
        if not text:
            return None
        try:
            cleaned = re.sub(r'[^\d.,]', '', text)
            cleaned = cleaned.replace('.', '').replace(',', '.')
            return float(cleaned)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_float(text: str) -> float:
        if not text:
            return 0.0
        try:
            cleaned = re.sub(r'[^\d.,]', '', text).replace(',', '.')
            return float(cleaned) if cleaned else 0.0
        except (ValueError, TypeError):
            return 0.0

    @staticmethod
    def _parse_int(text: str) -> int:
        if not text:
            return 0
        match = re.search(r'(\d+)', text)
        return int(match.group(1)) if match else 0
