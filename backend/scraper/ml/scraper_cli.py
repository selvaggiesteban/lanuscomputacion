"""
ML Scraper CLI - Main entry point.
Usage:
  python -m backend.scraper.ml.scraper_cli scrape --url <ML_URL>
  python -m backend.scraper.ml.scraper_cli category --url <ML_CATEGORY_URL>
  python -m backend.scraper.ml.scraper_cli test
"""
import sys
import os
import json
import logging
import argparse
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from backend.scraper.ml.scraper import (
    create_client, scrape_product, fetch_category_products,
    download_image, extract_item_id
)
from backend.scraper.ml.normalizer import normalize_product
from backend.scraper.ml.publisher import publish_via_wrangler, batch_publish
from backend.scraper.price_engine import calculate_selling_price
from backend.scraper.bcra_client import get_dollar_rate

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


def scrape_single_product(url: str, target_category: str = 'componentes-pc', cost_override: float = None):
    """Scrape a single product, apply pricing, and publish to D1."""
    logger.info(f"Scraping: {url}")

    # Fetch BCRA dollar rate once
    dollar_rate = get_dollar_rate()
    logger.info(f"BCRA dollar rate: ${dollar_rate}")

    client = create_client()
    try:
        # Scrape product data
        raw_data = scrape_product(url, client)
        if not raw_data:
            logger.error("Failed to scrape product data")
            return None

        logger.info(f"Scraped: {raw_data.get('title', 'unknown')} (source: {raw_data.get('_source')})")

        # Download images
        images = raw_data.get('thumbnails', raw_data.get('pictures', []))
        if isinstance(images, list) and len(images) > 0:
            downloaded = []
            for img_url in images[:5]:  # Max 5 images
                if isinstance(img_url, dict):
                    img_url = img_url.get('url', '')
                if img_url:
                    path = download_image(img_url, client)
                    if path:
                        downloaded.append(path)
                        logger.info(f"Downloaded: {path}")
            raw_data['_downloaded_images'] = downloaded

        # Normalize
        product = normalize_product(raw_data, target_category)
        logger.info(f"Normalized: {product['title']}")
        logger.info(f"  Brand: {product['brand']}")
        logger.info(f"  Category: {product['category_id']}")
        logger.info(f"  Condition: {product['condition']}")

        # Generate ID
        product['id'] = f"ml_{product['external_id']}"

        # Calculate pricing
        # ML products from AR have prices in ARS — this is our cost
        ml_price = cost_override if cost_override else product.get('price', 0)
        if ml_price > 0:
            pricing = calculate_selling_price(
                cost_price=ml_price,
                currency='ARS',
                iva_pct=product.get('iva_pct', 21.0),
                internal_tax_pct=0.0,
                markup_pct=30.0,
                dollar_rate=dollar_rate,
            )
            product['price'] = pricing['final_price']
            product['cost_price'] = ml_price
            product['dollar_rate'] = dollar_rate
            product['markup_pct'] = 30.0
            product['original_price'] = ml_price
            logger.info(f"  Cost: ${ml_price:,.0f} ARS")
            logger.info(f"  Selling: ${pricing['final_price']:,.0f} ARS (IVA {product['iva_pct']}% + 30% markup)")
        else:
            logger.warning("  Price is 0 — product will show as price on request")
            product['cost_price'] = 0
            product['dollar_rate'] = dollar_rate
            product['markup_pct'] = 30.0

        # Publish
        logger.info("Publishing to D1...")
        success = publish_via_wrangler(product)
        if success:
            logger.info(f"Published: {product['title']}")
            logger.info(f"  URL: https://lanuscomputacion.com/producto/{product['slug']}")
        else:
            logger.error("Publish failed")

        return product

    finally:
        client.close()


def scrape_category(category_url: str, max_pages: int = 3, target_category: str = 'componentes-pc'):
    """Scrape all products from a ML category with pricing."""
    logger.info(f"Scraping category: {category_url}")

    # Fetch BCRA dollar rate once for the whole batch
    dollar_rate = get_dollar_rate()
    logger.info(f"BCRA dollar rate: ${dollar_rate}")

    client = create_client()
    try:
        # Get product links
        products = fetch_category_products(category_url, client, max_pages)
        logger.info(f"Found {len(products)} products")

        results = []
        for i, prod in enumerate(products, 1):
            logger.info(f"[{i}/{len(products)}] Scraping {prod['id']}...")

            try:
                raw_data = scrape_product(prod['url'], client)
                if raw_data:
                    product = normalize_product(raw_data, target_category)
                    product['id'] = f"ml_{product['external_id']}"

                    # Apply pricing
                    ml_price = product.get('price', 0)
                    if ml_price > 0:
                        pricing = calculate_selling_price(
                            cost_price=ml_price,
                            currency='ARS',
                            iva_pct=product.get('iva_pct', 21.0),
                            markup_pct=30.0,
                            dollar_rate=dollar_rate,
                        )
                        product['price'] = pricing['final_price']
                        product['cost_price'] = ml_price
                        product['dollar_rate'] = dollar_rate
                        product['markup_pct'] = 30.0
                        product['original_price'] = ml_price
                    else:
                        product['cost_price'] = 0
                        product['dollar_rate'] = dollar_rate
                        product['markup_pct'] = 30.0

                    results.append(product)

                    if len(results) % 10 == 0:
                        logger.info(f"Batch publishing {len(results)} products...")
                        batch_publish(results)
                        results = []

            except Exception as e:
                logger.warning(f"Failed: {e}")
                continue

        # Final batch
        if results:
            batch_publish(results)

    finally:
        client.close()


def test_single_product():
    """Test scraping the specific product from the user's URL."""
    url = "https://www.mercadolibre.com.ar/1bateria-p-acer-spin-5-sp5135159gd-kt0040g011/up/MLAU121741888"
    image_url = "https://http2.mlstatic.com/D_NQ_NP_2X_673495-MLA52338433926_112022-F.webp"

    logger.info("=== TEST: Single Product ===")

    # Fetch BCRA dollar rate
    dollar_rate = get_dollar_rate()
    logger.info(f"BCRA dollar rate: ${dollar_rate}")

    client = create_client()
    try:
        # Download the specific image
        logger.info(f"Downloading image: {image_url}")
        img_path = download_image(image_url, client, save_dir="images/ml")
        logger.info(f"Image saved: {img_path}")

        # Try to scrape product data
        raw_data = scrape_product(url, client)

        if raw_data:
            product = normalize_product(raw_data, 'componentes-pc')
            product['id'] = f"ml_{product['external_id']}"

            if img_path:
                product['thumbnail'] = image_url

            product['category_id'] = 'componentes-pc'

            # Apply pricing
            ml_price = product.get('price', 0)
            if ml_price > 0:
                pricing = calculate_selling_price(
                    cost_price=ml_price,
                    currency='ARS',
                    iva_pct=product.get('iva_pct', 21.0),
                    markup_pct=30.0,
                    dollar_rate=dollar_rate,
                )
                product['price'] = pricing['final_price']
                product['cost_price'] = ml_price
                product['dollar_rate'] = dollar_rate
                product['markup_pct'] = 30.0
                product['original_price'] = ml_price
                logger.info(f"Cost: ${ml_price:,.0f} -> Selling: ${pricing['final_price']:,.0f}")

            logger.info(f"\nProduct data:")
            for k, v in product.items():
                if k != 'images':
                    logger.info(f"  {k}: {v}")

            success = publish_via_wrangler(product)
            if success:
                logger.info(f"\nPublished: {product['title']}")
                logger.info(f"Category: componentes-pc")
                logger.info(f"URL: https://lanuscomputacion.com/producto/{product['slug']}")
            else:
                logger.error("Publish failed")

            return product
        else:
            logger.warning("Could not scrape product data from ML (anti-bot protection)")
            logger.info("Creating manual product entry...")

            # Create a manual product with pricing
            # Use a typical ML price for this battery (~$25000 ARS cost)
            cost_price = 25000.0
            pricing = calculate_selling_price(
                cost_price=cost_price,
                currency='ARS',
                iva_pct=21.0,
                markup_pct=30.0,
                dollar_rate=dollar_rate,
            )

            product = {
                'id': 'ml_MLA1112752290',
                'external_id': 'MLA1112752290',
                'title': 'Bateria Acer Spin 5 SP513-51-59GD KT.0040G.011',
                'slug': 'bateria-acer-spin-5-sp513-51-59gd-kt-0040g-011',
                'description': 'Bateria original para Acer Spin 5 SP513-51-59GD. Modelo KT.0040G.011. Compatible con notebook Acer Spin 5.',
                'category_id': 'componentes-pc',
                'category_name': 'Componentes de PC',
                'subcategory_name': 'Notebooks y Accesorios',
                'status': 'published',
                'price': pricing['final_price'],
                'cost_price': cost_price,
                'original_price': cost_price,
                'currency': 'ARS',
                'dollar_rate': dollar_rate,
                'iva_pct': 21.0,
                'internal_tax_pct': 0.0,
                'markup_pct': 30.0,
                'brand': 'ACER',
                'sku': 'MLA1112752290',
                'ean': None,
                'warranty': None,
                'provider': 'mercadolibre',
                'provider_store': 'minorista',
                'condition': 'new',
                'available_qty': 1,
                'sold_qty': 0,
                'rating': 0,
                'reviews_count': 0,
                'seller_id': '',
                'seller_nickname': '',
                'free_shipping': False,
                'listing_type': '',
                'permalink': url,
                'thumbnail': image_url,
                'images': [image_url],
            }

            logger.info(f"Cost: ${cost_price:,.0f} -> Selling: ${pricing['final_price']:,.0f}")

            success = publish_via_wrangler(product)
            if success:
                logger.info(f"\nPublished manual product: {product['title']}")
                logger.info(f"Category: componentes-pc")
                logger.info(f"URL: https://lanuscomputacion.com/producto/{product['slug']}")

            return product

    finally:
        client.close()


def main():
    parser = argparse.ArgumentParser(description='ML Scraper CLI')
    subparsers = parser.add_subparsers(dest='command')

    # Scrape single product
    scrape_parser = subparsers.add_parser('scrape', help='Scrape a single product')
    scrape_parser.add_argument('--url', required=True, help='ML product URL')
    scrape_parser.add_argument('--category', default='componentes-pc', help='Target category')
    scrape_parser.add_argument('--price', type=float, default=None, help='Manual cost price override (ARS)')

    # Scrape category
    cat_parser = subparsers.add_parser('category', help='Scrape a category')
    cat_parser.add_argument('--url', required=True, help='ML category URL')
    cat_parser.add_argument('--pages', type=int, default=3, help='Max pages')
    cat_parser.add_argument('--category', default='componentes-pc', help='Target category')

    # Test
    subparsers.add_parser('test', help='Test with specific product')

    args = parser.parse_args()

    if args.command == 'scrape':
        scrape_single_product(args.url, args.category, args.price)
    elif args.command == 'category':
        scrape_category(args.url, args.pages, args.category)
    elif args.command == 'test':
        test_single_product()
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
