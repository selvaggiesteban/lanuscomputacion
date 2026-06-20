"""
ML Scraper: navigates MercadoLibre with Playwright, takes screenshots, extracts data.
"""
import re
import time
import random
import logging
from typing import Optional
from urllib.parse import urlparse, parse_qs

from playwright.sync_api import sync_playwright, Browser, Page

logger = logging.getLogger(__name__)

# User agents for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]

VIEWPORTS = [
    {"width": 1280, "height": 720},
    {"width": 1366, "height": 768},
    {"width": 1920, "height": 1080},
]


def extract_item_id(url: str) -> Optional[str]:
    """Extract MLA item ID from various ML URL formats."""
    match = re.search(r'(MLA\d{8,12})', url)
    if match:
        return match.group(1)

    match = re.search(r'MLAU(\d+)', url)
    if match:
        return f"MLA{match.group(1)}"

    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    if 'wid' in qs:
        return qs['wid'][0]

    return None


def _random_delay(min_s: float = 1.5, max_s: float = 3.5):
    """Random delay to avoid detection."""
    time.sleep(random.uniform(min_s, max_s))


class MLScraper:
    """Playwright-based MercadoLibre scraper."""

    def __init__(self):
        self._pw = None
        self._browser = None

    def start(self):
        """Start Playwright browser."""
        self._pw = sync_playwright().start()
        self._browser = self._pw.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-dev-shm-usage',
            ]
        )
        logger.info("Playwright browser started")

    def stop(self):
        """Stop Playwright browser."""
        if self._browser:
            self._browser.close()
        if self._pw:
            self._pw.stop()
        logger.info("Playwright browser stopped")

    def _new_page(self) -> Page:
        """Create a new page with random user agent and viewport."""
        context = self._browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport=random.choice(VIEWPORTS),
            locale='es-AR',
            timezone_id='America/Argentina/Buenos_Aires',
        )
        # Remove webdriver detection
        context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        """)
        return context.new_page()

    def fetch_category_links(self, category_url: str, max_pages: int = 5) -> list[dict]:
        """
        Fetch product links from a ML category listing page.
        Returns: [{'id': 'MLA12345678', 'url': 'https://...'}]
        """
        product_ids = []
        seen_ids = set()

        page = self._new_page()
        try:
            for pg in range(1, max_pages + 1):
                url = category_url if pg == 1 else f"{category_url}_Desde_{(pg - 1) * 48 + 1}"
                logger.info(f"Category page {pg}: {url}")

                try:
                    page.goto(url, wait_until='domcontentloaded', timeout=30000)
                    page.wait_for_selector('a[href*="/MLA"]', timeout=10000)
                except Exception as e:
                    logger.warning(f"Category page load failed: {e}")
                    break

                # Extract product links
                links = page.eval_on_selector_all(
                    'a[href*="/MLA"]',
                    """elements => elements.map(el => ({
                        href: el.href,
                        text: el.textContent.trim().substring(0, 50)
                    }))"""
                )

                new_count = 0
                for link in links:
                    href = link.get('href', '')
                    item_id = extract_item_id(href)
                    if item_id and item_id not in seen_ids:
                        seen_ids.add(item_id)
                        product_ids.append({'id': item_id, 'url': href})
                        new_count += 1

                logger.info(f"  Found {new_count} new products (total: {len(product_ids)})")

                if new_count == 0:
                    break

                # Check for next page
                try:
                    next_btn = page.query_selector('a.andes-pagination__link--next')
                    if not next_btn:
                        break
                except:
                    break

                _random_delay(2, 4)

        finally:
            page.context.close()

        return product_ids

    def scrape_product(self, product_url: str) -> Optional[dict]:
        """
        Scrape a single product page: screenshot + image URLs + basic HTML data.
        Returns dict with screenshot_bytes, image_urls, and html_data.
        """
        page = self._new_page()
        try:
            logger.info(f"Scraping product: {product_url}")

            try:
                page.goto(product_url, wait_until='domcontentloaded', timeout=20000)
                # Wait for product gallery to load
                page.wait_for_selector('.ui-pdp-gallery, .ui-pdp-container, h1', timeout=10000)
                _random_delay(1, 2)
            except Exception as e:
                logger.warning(f"Product page load partial, taking screenshot anyway: {e}")

            # Take screenshot of the main content area
            try:
                # Try to get the product info container
                container = page.query_selector('.ui-pdp-container')
                if container:
                    screenshot_bytes = container.screenshot(type='png')
                else:
                    screenshot_bytes = page.screenshot(type='png', full_page=False)
            except Exception as e:
                logger.warning(f"Screenshot failed: {e}")
                screenshot_bytes = page.screenshot(type='png', full_page=False)

            # Extract image URLs from gallery
            image_urls = []
            try:
                # Try multiple selectors for ML images
                selectors = [
                    '.ui-pdp-gallery__figure__img',
                    'img[data-src]',
                    '.ui-pdp-image',
                    'img[src*="mlstatic"]',
                    '.poly-component__pictures img',
                ]
                for sel in selectors:
                    img_elements = page.eval_on_selector_all(
                        sel,
                        """elements => elements.map(el => ({
                            src: el.src || el.dataset.src || el.getAttribute('data-zoom') || '',
                            alt: el.alt || ''
                        }))"""
                    )
                    for img in img_elements:
                        src = img.get('src', '')
                        if src and 'mlstatic' in src and src not in image_urls:
                            # Convert to high-res URL
                            src = re.sub(r'https://http2\.mlstatic\.com/D_NQ_NP_\d+_F\.', 'https://http2.mlstatic.com/D_NQ_NP_2X_F.', src)
                            image_urls.append(src)

                # If no mlstatic images found, try all images on page
                if not image_urls:
                    all_imgs = page.eval_on_selector_all(
                        'img',
                        """elements => elements.map(el => ({
                            src: el.src || '',
                            alt: el.alt || '',
                            width: el.naturalWidth || 0
                        }))"""
                    )
                    for img in all_imgs:
                        src = img.get('src', '')
                        w = img.get('width', 0)
                        if src and w > 100 and 'mlstatic' in src:
                            image_urls.append(src)
            except Exception as e:
                logger.warning(f"Image extraction failed: {e}")

            # Extract basic HTML data as fallback
            html_data = {}
            try:
                # Title
                title_el = page.query_selector('h1.ui-pdp-title')
                if title_el:
                    html_data['title'] = title_el.inner_text().strip()

                # Price
                price_el = page.query_selector('.andes-money-amount__fraction')
                if price_el:
                    price_text = price_el.inner_text().strip().replace('.', '').replace(',', '.')
                    try:
                        html_data['price'] = float(price_text)
                    except ValueError:
                        pass

                # Currency
                currency_el = page.query_selector('.andes-money-amount__currency-symbol')
                if currency_el:
                    html_data['currency'] = 'ARS' if '$' in currency_el.inner_text() else 'USD'

                # Brand
                brand_el = page.query_selector('a.ui-pdp-action__link')
                if brand_el:
                    brand_text = brand_el.inner_text().strip()
                    if brand_text and len(brand_text) < 50:
                        html_data['brand'] = brand_text

                # Condition
                cond_el = page.query_selector('.ui-pdp-subtitle')
                if cond_el:
                    html_data['condition'] = cond_el.inner_text().strip()

                # Seller
                seller_el = page.query_selector('.seller-info')
                if seller_el:
                    html_data['seller'] = seller_el.inner_text().strip()

            except Exception as e:
                logger.warning(f"HTML data extraction failed: {e}")

            return {
                'url': product_url,
                'screenshot_bytes': screenshot_bytes,
                'image_urls': image_urls,
                'html_data': html_data,
            }

        finally:
            page.context.close()
