"""
Data Normalizer: transforms scraped ML data (OCR + HTML) into D1-compatible format.
"""
import re
import json
import unicodedata
from typing import Optional


# Category mapping: ML URL patterns -> our category_id
ML_CATEGORY_MAP = {
    'celulares-telefonos': 'celulares-telefonos',
    'celulares-smartphones': 'celulares-smartphones',
    'accesorios-celulares': 'accesorios-celulares',
    'repuestos-celulares': 'repuestos-celulares',
    'camaras-accesorios': 'camaras-accesorios',
    'camaras-digitales': 'camaras-digitales',
    'accesorios-camaras': 'accesorios-camaras',
    'filmadoras-camaras-accion': 'camaras-accion',
    'consolas-videojuegos': 'consolas-videojuegos',
    'videojuegos': 'videojuegos',
    'accesorios-consolas': 'accesorios-consolas',
    'computacion': 'computacion',
    'componentes-pc': 'componentes-pc',
    'impresion': 'impresion',
    'tablets': 'tablets',
    'pc-escritorio': 'pc-escritorio',
    'conectividad-redes': 'conectividad-redes',
    'monitores-accesorios': 'monitores-accesorios',
    'electronica-audio-video': 'electronica-audio-video',
    'audio': 'audio',
    'accesorios-audio-video': 'accesorios-audio-video',
    'componentes-electronicos': 'componentes-electronicos',
    'drones-accesorios': 'drones-accesorios',
    'televisores': 'televisores',
    'audio-vehiculos': 'audio-vehiculos',
}

# Brand extraction patterns
BRAND_PATTERNS = [
    r'(?:^|\s)(ACER|Acer|acer)\b',
    r'(?:^|\s)(HP|hp|Hp)\b',
    r'(?:^|\s)(DELL|Dell|dell)\b',
    r'(?:^|\s)(LENOVO|Lenovo|lenovo)\b',
    r'(?:^|\s)(ASUS|Asus|asus)\b',
    r'(?:^|\s)(MSI|Msi|msi)\b',
    r'(?:^|\s)(GIGABYTE|Gigabyte|gigabyte)\b',
    r'(?:^|\s)(SAMSUNG|Samsung|samsung)\b',
    r'(?:^|\s)(KINGSTON|Kingston|kingston)\b',
    r'(?:^|\s)(CORSAIR|Corsair|corsair)\b',
    r'(?:^|\s)(COOLER\s*MASTER|Cooler\s*Master)\b',
    r'(?:^|\s)(LOGITECH|Logitech|logitech)\b',
    r'(?:^|\s)(RAZER|Razer|razer)\b',
    r'(?:^|\s)(WD|Western\s*Digital)\b',
    r'(?:^|\s)(SANDISK|SanDisk|sandisk)\b',
    r'(?:^|\s)(EPSON|Epson|epson)\b',
    r'(?:^|\s)(BROTHER|Brother|brother)\b',
    r'(?:^|\s)(CANON|Canon|canon)\b',
    r'(?:^|\s)(PHILIPS|Philips|philips)\b',
    r'(?:^|\s)(SONY|Sony|sony)\b',
    r'(?:^|\s)(INTEL|Intel|intel)\b',
    r'(?:^|\s)(AMD|Amd)\b',
    r'(?:^|\s)(NVIDIA|Nvidia|nvidia)\b',
    r'(?:^|\s)(LEXAR|Lexar|lexar)\b',
    r'(?:^|\s)(ADATA|Adata|adata)\b',
    r'(?:^|\s)(XIAOMI|Xiaomi|xiaomi)\b',
    r'(?:^|\s)(MOTOROLA|Motorola|motorola)\b',
    r'(?:^|\s)(APPLE|Apple|apple)\b',
    r'(?:^|\s)(HUAWEI|Huawei|huawei)\b',
]


def normalize_title(title: str) -> str:
    """Normalize product title for SEO."""
    if not title:
        return ""

    # Remove ML-specific prefixes
    title = re.sub(r'^\d+\s*[-–]\s*', '', title)
    title = re.sub(r'\s+', ' ', title).strip()

    # Capitalize properly
    words = title.split()
    result = []
    small_words = {'de', 'del', 'la', 'el', 'en', 'con', 'para', 'por', 'y', 'o', 'a', 'al'}
    for i, word in enumerate(words):
        if i == 0 or word.lower() not in small_words:
            result.append(word.capitalize() if word.islower() else word)
        else:
            result.append(word.lower())

    return ' '.join(result)


def extract_brand_from_title(title: str) -> Optional[str]:
    """Extract brand from title using regex patterns."""
    for pattern in BRAND_PATTERNS:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            return match.group(1).upper()

    # Common brand words fallback
    brand_words = [
        'Acer', 'HP', 'Dell', 'Lenovo', 'Asus', 'MSI', 'Gigabyte',
        'Samsung', 'Kingston', 'Corsair', 'Logitech', 'Razer', 'WD',
        'SanDisk', 'Epson', 'Brother', 'Canon', 'Philips', 'Sony',
        'Intel', 'AMD', 'Nvidia', 'Lexar', 'Adata', 'Xiaomi',
        'Motorola', 'Apple', 'Huawei', 'Open', 'Genius', 'Split',
        'Phoenix', 'Maxprint', 'Noc', 'Storm', 'Everest', 'Ghia',
        'Peach', 'Forza', 'Cudy', 'Tp-Link', 'Tenda', 'Colorful',
    ]
    for brand in brand_words:
        if brand.lower() in title.lower():
            return brand.upper()

    return None


def generate_seo_slug(title: str) -> str:
    """Generate SEO-friendly URL slug from title."""
    if not title:
        return ''

    # Normalize unicode
    slug = unicodedata.normalize('NFKD', title)
    slug = slug.encode('ascii', 'ignore').decode('ascii')

    # Lowercase and replace special chars
    slug = slug.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')

    return slug[:100]  # max length for SEO


def map_category_from_url(url: str) -> str:
    """Map ML URL to our category_id."""
    url_lower = url.lower()
    for key, category_id in ML_CATEGORY_MAP.items():
        if key in url_lower:
            return category_id
    return 'otros'


def normalize_product(
    item_id: str,
    url: str,
    ocr_data: dict,
    html_data: dict,
    image_urls: list[str],
    r2_urls: list[str],
    category_slug: str,
) -> dict:
    """
    Normalize scraped data into D1-compatible product dict.
    Priority: OCR data > HTML data > defaults.
    """
    # Title: prefer HTML (more reliable), fallback to OCR
    html_title = html_data.get('title', '')
    ocr_title = ocr_data.get('title', '')
    # Use HTML title if available (more accurate), otherwise OCR
    title = html_title or ocr_title
    title = normalize_title(title)

    # Price: prefer OCR, fallback to HTML
    price = ocr_data.get('price') or html_data.get('price', 0)

    # Brand: prefer OCR, fallback to HTML, then title extraction
    brand = ocr_data.get('brand') or html_data.get('brand', '')
    if not brand:
        brand = extract_brand_from_title(title) or ''

    # Condition
    condition = ocr_data.get('condition') or html_data.get('condition', 'new')
    if condition not in ('new', 'used', 'refurbished'):
        condition = 'new'

    # Stock
    stock = ocr_data.get('stock', 1)

    # Slug from title
    slug = generate_seo_slug(title)

    # Images: use R2 URLs if available, otherwise original ML URLs
    thumbnail = r2_urls[0] if r2_urls else (image_urls[0] if image_urls else '')
    images_json = json.dumps(r2_urls if r2_urls else image_urls[:5])

    # Category
    category_id = category_slug or map_category_from_url(url)

    return {
        'id': f"ml_{item_id}",
        'external_id': item_id,
        'title': title,
        'slug': slug,
        'description': '',
        'category_id': category_id,
        'category_name': category_id.replace('-', ' ').title(),
        'subcategory_name': '',
        'status': 'published' if price > 0 else 'draft',
        'price': round(price, 2),
        'cost_price': round(price, 2),
        'original_price': round(price, 2),
        'currency': html_data.get('currency', 'ARS'),
        'dollar_rate': 0,
        'iva_pct': 21.0,
        'internal_tax_pct': 0.0,
        'markup_pct': 0.0,
        'brand': brand,
        'sku': item_id,
        'ean': None,
        'warranty': None,
        'provider': 'mercadolibre',
        'provider_store': 'minorista',
        'condition': condition,
        'available_qty': stock,
        'sold_qty': 0,
        'rating': 0,
        'reviews_count': 0,
        'seller_id': '',
        'seller_nickname': html_data.get('seller', ''),
        'free_shipping': 0,
        'listing_type': '',
        'permalink': url,
        'thumbnail': thumbnail,
        'images': images_json,
    }
