"""
MercadoLibre Scraper - fetches product data from ML URLs.
Uses public API + HTML fallback with proper headers.
"""
import re
import json
import time
import hashlib
import logging
from urllib.parse import urlparse, parse_qs
from typing import Optional

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

ML_API_BASE = "https://api.mercadolibre.com"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}


def extract_item_id(url: str) -> Optional[str]:
    """Extract MLA item ID from various ML URL formats."""
    # MLA12345678 pattern
    match = re.search(r'(MLA\d{8,12})', url)
    if match:
        return match.group(1)

    # MLAU pattern (variation) - extract base
    match = re.search(r'MLAU(\d+)', url)
    if match:
        return f"MLA{match.group(1)}"

    # wid=MLA12345678
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    if 'wid' in qs:
        return qs['wid'][0]

    return None


def extract_category_from_url(url: str) -> Optional[str]:
    """Extract category slug from ML category URL."""
    parsed = urlparse(url)
    parts = [p for p in parsed.path.split('/') if p]
    if 'category' in parts:
        idx = parts.index('category')
        if idx + 1 < len(parts):
            return parts[idx + 1]
    return None


def fetch_item_api(item_id: str, client: httpx.Client) -> Optional[dict]:
    """Fetch product data from ML API."""
    try:
        resp = client.get(f"{ML_API_BASE}/items/{item_id}", headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            return resp.json()
        logger.warning(f"API returned {resp.status_code} for {item_id}")
    except Exception as e:
        logger.warning(f"API fetch failed for {item_id}: {e}")
    return None


def fetch_item_html(url: str, client: httpx.Client) -> Optional[dict]:
    """Fetch product data from HTML page as fallback."""
    try:
        resp = client.get(url, headers=HEADERS, timeout=20, follow_redirects=True)
        if resp.status_code != 200:
            logger.warning(f"HTML returned {resp.status_code}")
            return None

        soup = BeautifulSoup(resp.text, 'html.parser')

        data = {}

        # Title
        title_el = soup.find('h1', class_=re.compile(r'ui-pdp-title'))
        if title_el:
            data['title'] = title_el.get_text(strip=True)

        # Price
        price_el = soup.find('span', class_=re.compile(r'andes-money-amount__fraction'))
        if price_el:
            price_text = price_el.get_text(strip=True).replace('.', '').replace(',', '.')
            try:
                data['price'] = float(price_text)
            except ValueError:
                pass

        # Currency
        currency_el = soup.find('span', class_=re.compile(r'andes-money-amount__currency-symbol'))
        if currency_el:
            data['currency'] = 'ARS' if '$' in currency_el.text else 'USD'

        # Brand
        brand_el = soup.find('a', class_=re.compile(r'ui-pdp-action__link'))
        if brand_el and 'Marca' in brand_el.parent.get_text():
            data['brand'] = brand_el.get_text(strip=True)

        # Description
        desc_el = soup.find('div', class_=re.compile(r'ui-pdp-description'))
        if desc_el:
            data['description'] = desc_el.get_text(strip=True)[:2000]

        # Images
        imgs = soup.find_all('img', class_=re.compile(r'ui-pdp-gallery__figure__img'))
        data['thumbnails'] = [img.get('src') for img in imgs if img.get('src')]

        # Seller
        seller_el = soup.find('a', class_=re.compile(r'seller-info'))
        if seller_el:
            data['seller_name'] = seller_el.get_text(strip=True)

        # Condition
        cond_el = soup.find('span', class_=re.compile(r'ui-pdp-subtitle'))
        if cond_el:
            data['condition'] = cond_el.get_text(strip=True)

        # Sold quantity
        sold_el = soup.find('span', class_=re.compile(r'sold'))
        if sold_el:
            match = re.search(r'(\d+)', sold_el.text)
            if match:
                data['sold_quantity'] = int(match.group(1))

        # Review rating
        rating_el = soup.find('span', class_=re.compile(r'review'));
        if rating_el:
            match = re.search(r'([\d,.]+)', rating_el.text)
            if match:
                data['reviews'] = {'rating_average': float(match.group(1).replace(',', '.'))}

        return data if data.get('title') else None

    except Exception as e:
        logger.warning(f"HTML fetch failed: {e}")
    return None


def fetch_category_products(category_url: str, client: httpx.Client, max_pages: int = 5) -> list[dict]:
    """Fetch all product links from a ML category listing page."""
    product_ids = []

    for page in range(1, max_pages + 1):
        url = category_url if page == 1 else f"{category_url}_Desde_{(page-1)*48+1}"
        try:
            resp = client.get(url, headers=HEADERS, timeout=20, follow_redirects=True)
            if resp.status_code != 200:
                break

            soup = BeautifulSoup(resp.text, 'html.parser')

            # Find product links
            links = soup.find_all('a', href=re.compile(r'/MLA\d+'))
            if not links:
                break

            for link in links:
                href = link.get('href', '')
                item_id = extract_item_id(href)
                if item_id and item_id not in [p['id'] for p in product_ids]:
                    product_ids.append({'id': item_id, 'url': href})

            # Check for next page
            next_btn = soup.find('a', class_=re.compile(r'andes-pagination__link--next'))
            if not next_btn:
                break

            time.sleep(1)  # Rate limit

        except Exception as e:
            logger.warning(f"Category page fetch failed: {e}")
            break

    return product_ids


def scrape_product(url: str, client: httpx.Client) -> Optional[dict]:
    """Scrape a single product from its URL."""
    item_id = extract_item_id(url)
    if not item_id:
        logger.error(f"Could not extract item ID from: {url}")
        return None

    # Try API first
    data = fetch_item_api(item_id, client)
    if data:
        data['_source'] = 'api'
        return data

    # Fallback to HTML
    data = fetch_item_html(url, client)
    if data:
        data['id'] = item_id
        data['_source'] = 'html'
        return data

    return None


def download_image(url: str, client: httpx.Client, save_dir: str = "images/ml") -> Optional[str]:
    """Download an image and return the local path."""
    import os

    os.makedirs(save_dir, exist_ok=True)

    # Generate filename from URL hash
    url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
    ext = '.webp' if '.webp' in url else '.jpg'
    filename = f"ml_{url_hash}{ext}"
    filepath = os.path.join(save_dir, filename)

    if os.path.exists(filepath):
        return filepath

    try:
        resp = client.get(url, headers=HEADERS, timeout=30)
        if resp.status_code == 200:
            with open(filepath, 'wb') as f:
                f.write(resp.content)
            return filepath
    except Exception as e:
        logger.warning(f"Image download failed: {e}")

    return None


def create_client() -> httpx.Client:
    """Create an HTTP client with retry logic."""
    return httpx.Client(
        follow_redirects=True,
        timeout=20,
        limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
    )
