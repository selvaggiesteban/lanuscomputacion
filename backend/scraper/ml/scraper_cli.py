"""
ML Scraper CLI - Orchestrator for scraping MercadoLibre with PaddleOCR.
Usage:
  python -m backend.scraper.ml.scraper_cli test --products 5
  python -m backend.scraper.ml.scraper_cli category --url <URL> --limit 500
  python -m backend.scraper.ml.scraper_cli all --limit 10000
"""
import sys
import os
import logging
import argparse
import time
import random
import httpx

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from backend.scraper.ml.scraper import MLScraper, extract_item_id
from backend.scraper.ml.ocr import ocr_screenshot
from backend.scraper.ml.image_manager import process_product_images, create_alt_text
from backend.scraper.ml.normalizer import normalize_product, generate_seo_slug
from backend.scraper.ml.publisher import publish_via_wrangler, batch_publish

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Category URLs
ML_CATEGORIES = {
    "celulares-telefonos": "https://www.mercadolibre.com.ar/c/celulares-y-telefonos",
    "camaras-accesorios": "https://www.mercadolibre.com.ar/c/camaras-y-accesorios",
    "consolas-videojuegos": "https://www.mercadolibre.com.ar/c/consolas-y-videojuegos",
    "computacion": "https://www.mercadolibre.com.ar/c/computacion",
    "electronica-audio-video": "https://www.mercadolibre.com.ar/c/electronica-audio-y-video",
    "celulares-smartphones": "https://listado.mercadolibre.com.ar/celulares-telefonos/celulares-smartphones/",
    "accesorios-celulares": "https://listado.mercadolibre.com.ar/celulares-telefonos/accesorios-celulares/",
    "repuestos-celulares": "https://listado.mercadolibre.com.ar/celulares-telefonos/repuestos-celulares/",
    "camaras-digitales": "https://listado.mercadolibre.com.ar/camaras-accesorios/camaras/camaras-digitales/",
    "accesorios-camaras": "https://listado.mercadolibre.com.ar/camaras-accesorios/accesorios-camaras/",
    "camaras-accion": "https://listado.mercadolibre.com.ar/camaras-accesorios/filmadoras-camaras-accion/",
    "videojuegos": "https://listado.mercadolibre.com.ar/consolas-videojuegos/videojuegos/",
    "accesorios-playstation": "https://listado.mercadolibre.com.ar/consolas-videojuegos/accesorios-consolas/playstation/",
    "accesorios-nintendo": "https://listado.mercadolibre.com.ar/consolas-videojuegos/accesorios-consolas/nintendo/",
    "componentes-pc": "https://listado.mercadolibre.com.ar/computacion/componentes-pc/",
    "impresion": "https://listado.mercadolibre.com.ar/computacion/impresion/",
    "tablets": "https://listado.mercadolibre.com.ar/computacion/tablets-accesorios/tablets/",
    "pc-escritorio": "https://listado.mercadolibre.com.ar/computacion/pc-escritorio/pc/",
    "conectividad-redes": "https://listado.mercadolibre.com.ar/computacion/conectividad-redes/",
    "monitores-accesorios": "https://listado.mercadolibre.com.ar/computacion/monitores-accesorios/",
    "audio": "https://listado.mercadolibre.com.ar/electronica-audio-video/audio/",
    "accesorios-audio-video": "https://listado.mercadolibre.com.ar/electronica-audio-video/accesorios-audio-video/",
    "componentes-electronicos": "https://listado.mercadolibre.com.ar/electronica-audio-video/componentes-electronicos/",
    "drones-accesorios": "https://listado.mercadolibre.com.ar/electronica-audio-video/drones-accesorios/",
    "audio-vehiculos": "https://listado.mercadolibre.com.ar/accesorios-vehiculos/audio-vehiculos/",
    "televisores": "https://listado.mercadolibre.com.ar/electronica-audio-video/televisores/",
}


def scrape_single_product(url: str, category_slug: str = "otros"):
    """Scrape a single product: screenshot, OCR, images, publish."""
    logger.info(f"=== Scraping single product: {url} ===")

    scraper = MLScraper()
    http_client = httpx.Client(follow_redirects=True, timeout=30)

    try:
        scraper.start()

        # 1. Scrape product page
        result = scraper.scrape_product(url)
        if not result:
            logger.error("Failed to scrape product")
            return None

        # 2. OCR on screenshot
        logger.info("Running OCR on screenshot...")
        ocr_data = ocr_screenshot(result['screenshot_bytes'])

        # 3. Merge OCR and HTML data
        html_data = result.get('html_data', {})
        logger.info(f"OCR: title={ocr_data.get('title')}, price={ocr_data.get('price')}")
        logger.info(f"HTML: title={html_data.get('title')}, price={html_data.get('price')}")

        # 4. Download and upload images to R2
        item_id = extract_item_id(url)
        if not item_id:
            logger.error("Could not extract item ID")
            return None

        # Generate product slug for image filenames
        title = ocr_data.get('title') or html_data.get('title', '')
        product_slug = generate_seo_slug(title) or f"product-{item_id}"

        logger.info("Processing images...")
        r2_urls = process_product_images(
            result.get('image_urls', []),
            product_slug,
            category_slug,
            http_client,
        )

        # 5. Normalize product data
        product = normalize_product(
            item_id=item_id,
            url=url,
            ocr_data=ocr_data,
            html_data=html_data,
            image_urls=result.get('image_urls', []),
            r2_urls=r2_urls,
            category_slug=category_slug,
        )

        logger.info(f"Product: {product['title']}")
        logger.info(f"Price: ${product['price']:,.0f} ARS")
        logger.info(f"Brand: {product['brand']}")
        logger.info(f"Images: {len(r2_urls)} uploaded to R2")

        # 6. Publish to D1
        logger.info("Publishing to D1...")
        success = publish_via_wrangler(product)
        if success:
            logger.info(f"Published: https://lanuscomputacion.com/producto/{product['slug']}")
        else:
            logger.error("Publish failed")

        return product

    finally:
        scraper.stop()
        http_client.close()


def scrape_category(category_url: str, category_slug: str, limit: int = 500):
    """Scrape products from a ML category."""
    logger.info(f"=== Scraping category: {category_slug} (limit: {limit}) ===")

    scraper = MLScraper()
    http_client = httpx.Client(follow_redirects=True, timeout=30)

    try:
        scraper.start()

        # 1. Get product links from category pages
        max_pages = (limit // 48) + 1
        product_links = scraper.fetch_category_links(category_url, max_pages=max_pages)
        logger.info(f"Found {len(product_links)} product links")

        # Limit to requested count
        product_links = product_links[:limit]

        # 2. Process each product
        batch = []
        processed = 0
        errors = 0

        for i, link in enumerate(product_links, 1):
            logger.info(f"[{i}/{len(product_links)}] {link['id']}")

            try:
                # Scrape product page
                result = scraper.scrape_product(link['url'])
                if not result:
                    errors += 1
                    continue

                # OCR
                ocr_data = ocr_screenshot(result['screenshot_bytes'])

                # Images to R2
                title = ocr_data.get('title') or result.get('html_data', {}).get('title', '')
                product_slug = generate_seo_slug(title) or f"product-{link['id']}"

                r2_urls = process_product_images(
                    result.get('image_urls', []),
                    product_slug,
                    category_slug,
                    http_client,
                )

                # Normalize
                product = normalize_product(
                    item_id=link['id'],
                    url=link['url'],
                    ocr_data=ocr_data,
                    html_data=result.get('html_data', {}),
                    image_urls=result.get('image_urls', []),
                    r2_urls=r2_urls,
                    category_slug=category_slug,
                )

                batch.append(product)
                processed += 1

                # Batch publish every 10 products
                if len(batch) >= 10:
                    result = batch_publish(batch)
                    logger.info(f"Batch published: {result['success']} OK, {result['failed']} failed")
                    batch = []

                # Rate limiting
                time.sleep(random.uniform(2, 4))

            except Exception as e:
                logger.warning(f"Error processing {link['id']}: {e}")
                errors += 1
                continue

        # Final batch
        if batch:
            result = batch_publish(batch)
            logger.info(f"Final batch: {result['success']} OK, {result['failed']} failed")

        logger.info(f"=== Category complete: {processed} products, {errors} errors ===")

    finally:
        scraper.stop()
        http_client.close()


def test_products(num_products: int = 5):
    """Test scraper with a few products from the first category."""
    logger.info(f"=== TEST: Scraping {num_products} products ===")

    # Use first category for testing
    test_category = "componentes-pc"
    test_url = ML_CATEGORIES[test_category]

    scrape_category(test_url, test_category, limit=num_products)


def scrape_all(limit: int = 10000):
    """Scrape all categories with product distribution."""
    logger.info(f"=== SCRAPE ALL: {limit} total products ===")

    # Distribute products across categories
    num_categories = len(ML_CATEGORIES)
    products_per_category = limit // num_categories
    remainder = limit % num_categories

    total_scraped = 0
    for i, (slug, url) in enumerate(ML_CATEGORIES.items()):
        # Add remainder to first categories
        cat_limit = products_per_category + (1 if i < remainder else 0)
        logger.info(f"Category {slug}: {cat_limit} products")

        scrape_category(url, slug, limit=cat_limit)
        total_scraped += cat_limit

    logger.info(f"=== ALL DONE: {total_scraped} products scraped ===")


def main():
    parser = argparse.ArgumentParser(description='ML Scraper CLI')
    subparsers = parser.add_subparsers(dest='command')

    # Test
    test_parser = subparsers.add_parser('test', help='Test with a few products')
    test_parser.add_argument('--products', type=int, default=5, help='Number of products to test')

    # Category
    cat_parser = subparsers.add_parser('category', help='Scrape a category')
    cat_parser.add_argument('--url', required=True, help='ML category URL')
    cat_parser.add_argument('--slug', required=True, help='Category slug for images')
    cat_parser.add_argument('--limit', type=int, default=500, help='Max products')

    # All
    all_parser = subparsers.add_parser('all', help='Scrape all categories')
    all_parser.add_argument('--limit', type=int, default=10000, help='Total product limit')

    args = parser.parse_args()

    if args.command == 'test':
        test_products(args.products)
    elif args.command == 'category':
        scrape_category(args.url, args.slug, args.limit)
    elif args.command == 'all':
        scrape_all(args.limit)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
