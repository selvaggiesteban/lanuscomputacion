"""
Data Normalizer: normalizes scraped ML data into D1-compatible format.
"""
import re
import unicodedata
from typing import Optional


# Category mapping: ML category_id -> our category_id
ML_CATEGORY_MAP = {
    # Componentes PC
    'MLA1648': 'componentes-pc',
    'MLA1652': 'componentes-pc',
    'MLA1653': 'componentes-pc',
    'MLA1654': 'componentes-pc',
    'MLA1655': 'componentes-pc',
    'MLA1656': 'componentes-pc',
    'MLA1657': 'componentes-pc',
    'MLA1658': 'componentes-pc',
    'MLA1659': 'componentes-pc',
    'MLA1660': 'componentes-pc',
    'MLA1661': 'componentes-pc',
    'MLA1662': 'componentes-pc',
    'MLA1663': 'componentes-pc',
    'MLA1664': 'componentes-pc',
    'MLA1665': 'componentes-pc',
    'MLA1666': 'componentes-pc',
    'MLA1667': 'componentes-pc',
    'MLA1668': 'componentes-pc',
    'MLA1669': 'componentes-pc',
    'MLA1670': 'componentes-pc',
    'MLA1671': 'componentes-pc',
    'MLA1672': 'componentes-pc',
    'MLA1673': 'componentes-pc',
    'MLA1674': 'componentes-pc',
    'MLA1675': 'componentes-pc',
    'MLA1676': 'componentes-pc',
    'MLA1677': 'componentes-pc',
    'MLA1678': 'componentes-pc',
    'MLA1679': 'componentes-pc',
    'MLA1680': 'componentes-pc',
    'MLA1681': 'componentes-pc',
    'MLA1682': 'componentes-pc',
    'MLA1683': 'componentes-pc',
    'MLA1684': 'componentes-pc',
    'MLA1685': 'componentes-pc',
    'MLA1686': 'componentes-pc',
    'MLA1687': 'componentes-pc',
    'MLA1688': 'componentes-pc',
    'MLA1689': 'componentes-pc',
    'MLA1690': 'componentes-pc',
    'MLA1691': 'componentes-pc',
    'MLA1692': 'componentes-pc',
    'MLA1693': 'componentes-pc',
    'MLA1694': 'componentes-pc',
    'MLA1695': 'componentes-pc',
    'MLA1696': 'componentes-pc',
    'MLA1697': 'componentes-pc',
    'MLA1698': 'componentes-pc',
    'MLA1699': 'componentes-pc',
    'MLA1700': 'componentes-pc',
    'MLA1701': 'componentes-pc',
    'MLA1702': 'componentes-pc',
    'MLA1703': 'componentes-pc',
    'MLA1704': 'componentes-pc',
    'MLA1705': 'componentes-pc',
    'MLA1706': 'componentes-pc',
    'MLA1707': 'componentes-pc',
    'MLA1708': 'componentes-pc',
    'MLA1709': 'componentes-pc',
    'MLA1710': 'componentes-pc',
    'MLA1711': 'componentes-pc',
    'MLA1712': 'componentes-pc',
    'MLA1713': 'componentes-pc',
    'MLA1714': 'componentes-pc',
    'MLA1715': 'componentes-pc',
    'MLA1716': 'componentes-pc',
    'MLA1717': 'componentes-pc',
    'MLA1718': 'componentes-pc',
    'MLA1719': 'componentes-pc',
    'MLA1720': 'componentes-pc',
    'MLA1721': 'componentes-pc',
    'MLA1722': 'componentes-pc',
    'MLA1723': 'componentes-pc',
    'MLA1724': 'componentes-pc',
    'MLA1725': 'componentes-pc',
    'MLA1726': 'componentes-pc',
    'MLA1727': 'componentes-pc',
    'MLA1728': 'componentes-pc',
    'MLA1729': 'componentes-pc',
    'MLA1730': 'componentes-pc',
    'MLA1731': 'componentes-pc',
    'MLA1732': 'componentes-pc',
    'MLA1733': 'componentes-pc',
    'MLA1734': 'componentes-pc',
    'MLA1735': 'componentes-pc',
    'MLA1736': 'componentes-pc',
    'MLA1737': 'componentes-pc',
    'MLA1738': 'componentes-pc',
    'MLA1739': 'componentes-pc',
    'MLA1740': 'componentes-pc',
    'MLA1741': 'componentes-pc',
    'MLA1742': 'componentes-pc',
    'MLA1743': 'componentes-pc',
    'MLA1744': 'componentes-pc',
    'MLA1745': 'componentes-pc',
    'MLA1746': 'componentes-pc',
    'MLA1747': 'componentes-pc',
    'MLA1748': 'componentes-pc',
    'MLA1749': 'componentes-pc',
    'MLA1750': 'componentes-pc',
    'MLA1751': 'componentes-pc',
    'MLA1752': 'componentes-pc',
    'MLA1753': 'componentes-pc',
    'MLA1754': 'componentes-pc',
    'MLA1755': 'componentes-pc',
    'MLA1756': 'componentes-pc',
    'MLA1757': 'componentes-pc',
    'MLA1758': 'componentes-pc',
    'MLA1759': 'componentes-pc',
    'MLA1760': 'componentes-pc',
    'MLA1761': 'componentes-pc',
    'MLA1762': 'componentes-pc',
    'MLA1763': 'componentes-pc',
    'MLA1764': 'componentes-pc',
    'MLA1765': 'componentes-pc',
    'MLA1766': 'componentes-pc',
    'MLA1767': 'componentes-pc',
    'MLA1768': 'componentes-pc',
    'MLA1769': 'componentes-pc',
    'MLA1770': 'componentes-pc',
    'MLA1771': 'componentes-pc',
    'MLA1772': 'componentes-pc',
    'MLA1773': 'componentes-pc',
    'MLA1774': 'componentes-pc',
    'MLA1775': 'componentes-pc',
    'MLA1776': 'componentes-pc',
    'MLA1777': 'componentes-pc',
    'MLA1778': 'componentes-pc',
    'MLA1779': 'componentes-pc',
    'MLA1780': 'componentes-pc',
    'MLA1781': 'componentes-pc',
    'MLA1782': 'componentes-pc',
    'MLA1783': 'componentes-pc',
    'MLA1784': 'componentes-pc',
    'MLA1785': 'componentes-pc',
    'MLA1786': 'componentes-pc',
    'MLA1787': 'componentes-pc',
    'MLA1788': 'componentes-pc',
    'MLA1789': 'componentes-pc',
    'MLA1790': 'componentes-pc',
    'MLA1791': 'componentes-pc',
    'MLA1792': 'componentes-pc',
    'MLA1793': 'componentes-pc',
    'MLA1794': 'componentes-pc',
    'MLA1795': 'componentes-pc',
    'MLA1796': 'componentes-pc',
    'MLA1797': 'componentes-pc',
    'MLA1798': 'componentes-pc',
    'MLA1799': 'componentes-pc',
    'MLA1800': 'componentes-pc',
    # Notebooks
    'MLA1652': 'notebooks-accesorios',
    # Baterías / Notebooks
    'MLA1696': 'componentes-pc',
    'MLA1697': 'componentes-pc',
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
    r'(?:^|\s)(LOGitech|Logitech|logitech)\b',
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
    r'(?:^|\s)(FORZA|Forza|forza)\b',
    r'(?:^|\s)(CUDY|Cudy|cudy)\b',
    r'(?:^|\s)(TP-LINK|Tp-Link|TP-Link)\b',
    r'(?:^|\s)(TENDA|Tenda|tenda)\b',
    r'(?:^|\s)(XIAOMI|Xiaomi|xiaomi)\b',
    r'(?:^|\s)(REDMI|Redmi|redmi)\b',
    r'(?:^|\s)(MOTOROLA|Motorola|motorola)\b',
    r'(?:^|\s)(SAMSUNG|Samsung|samsung)\b',
    r'(?:^|\s)(APPLE|Apple|apple)\b',
]


def normalize_title(title: str) -> str:
    """Normalize product title."""
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


def extract_brand(title: str, api_data: dict = None) -> Optional[str]:
    """Extract brand from title or API data."""
    # From API attributes
    if api_data and 'attributes' in api_data:
        for attr in api_data['attributes']:
            if attr.get('id') == 'BRAND':
                return attr.get('value_name')

    # From title patterns
    for pattern in BRAND_PATTERNS:
        match = re.search(pattern, title, re.IGNORECASE)
        if match:
            return match.group(1).upper()

    # Common patterns
    brand_words = [
        'Acer', 'HP', 'Dell', 'Lenovo', 'Asus', 'MSI', 'Gigabyte',
        'Samsung', 'Kingston', 'Corsair', 'Cooler Master', 'Logitech',
        'Razer', 'WD', 'SanDisk', 'Epson', 'Brother', 'Canon',
        'Philips', 'Sony', 'Intel', 'AMD', 'Nvidia', 'Lexar',
        'Adata', 'Forza', 'Cudy', 'TP-Link', 'Tenda', 'Xiaomi',
    ]
    for brand in brand_words:
        if brand.lower() in title.lower():
            return brand.upper()

    return None


def extract_ean(title: str, api_data: dict = None) -> Optional[str]:
    """Extract EAN/barcode."""
    if api_data and 'attributes' in api_data:
        for attr in api_data['attributes']:
            if attr.get('id') in ('GTIN', 'EAN'):
                return attr.get('value_name')

    # Try to find EAN pattern in title
    match = re.search(r'\b(\d{13})\b', title)
    if match:
        return match.group(1)

    return None


def normalize_price(price: float, currency: str = 'ARS') -> dict:
    """Normalize price data."""
    return {
        'price': round(price, 2),
        'currency': currency,
        'original_price': round(price, 2),
    }


def normalize_condition(condition: str) -> str:
    """Normalize product condition."""
    if not condition:
        return 'new'

    condition_lower = condition.lower()
    if 'nuevo' in condition_lower or 'new' in condition_lower:
        return 'new'
    elif 'usado' in condition_lower or 'used' in condition_lower:
        return 'used'
    elif 'reacondicionado' in condition_lower or 'refurbished' in condition_lower:
        return 'refurbished'

    return 'new'


def normalize_category(ml_category_id: str, fallback: str = 'componentes-pc') -> str:
    """Map ML category to our category."""
    return ML_CATEGORY_MAP.get(ml_category_id, fallback)


def generate_slug(title: str) -> str:
    """Generate URL-friendly slug from title."""
    if not title:
        return ''

    # Normalize unicode
    title = unicodedata.normalize('NFKD', title)
    title = title.encode('ascii', 'ignore').decode('ascii')

    # Lowercase and replace special chars
    slug = title.lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')

    return slug[:100]  # Max length


def normalize_product(raw_data: dict, source_category: str = 'componentes-pc') -> dict:
    """
    Normalize raw scraped data into D1-compatible product dict.
    """
    # Handle both API and HTML formats
    if raw_data.get('_source') == 'api':
        title = raw_data.get('title', '')
        price_data = normalize_price(
            raw_data.get('price', 0),
            raw_data.get('currency_id', 'ARS')
        )
        brand = extract_brand(title, raw_data)
        ean = extract_ean(title, raw_data)
        condition = normalize_condition(raw_data.get('condition', ''))
        ml_category = raw_data.get('category_id', '')
        thumbnails = raw_data.get('thumbnails', [])
        thumbnail = thumbnails[0] if thumbnails else raw_data.get('thumbnail', '')
        permalink = raw_data.get('permalink', '')
        seller_id = str(raw_data.get('seller_id', ''))
        sold_qty = raw_data.get('sold_quantity', 0)
        status = raw_data.get('status', '')
        available_qty = raw_data.get('initial_quantity', 0) - raw_data.get('sold_quantity', 0)

        description_parts = []
        if raw_data.get('attributes'):
            for attr in raw_data['attributes']:
                name = attr.get('name', '')
                value = attr.get('value_name', '')
                if name and value:
                    description_parts.append(f"{name}: {value}")

        return {
            'external_id': raw_data.get('id', ''),
            'title': normalize_title(title),
            'slug': generate_slug(title),
            'description': '\n'.join(description_parts[:50]),
            'category_id': normalize_category(ml_category, source_category),
            'category_name': ml_category,
            'subcategory_name': '',
            'status': 'published' if status == 'active' else 'draft',
            'price': price_data['price'],
            'cost_price': price_data['price'],
            'original_price': price_data['original_price'],
            'currency': price_data['currency'],
            'dollar_rate': 0,
            'iva_pct': 21.0,
            'internal_tax_pct': 0.0,
            'markup_pct': 0.0,
            'brand': brand,
            'sku': raw_data.get('id', ''),
            'ean': ean,
            'warranty': None,
            'provider': 'mercadolibre',
            'provider_store': 'minorista',
            'condition': condition,
            'available_qty': max(available_qty, 0),
            'sold_qty': sold_qty,
            'rating': raw_data.get('reviews', {}).get('rating_average', 0),
            'reviews_count': raw_data.get('reviews', {}).get('total', 0),
            'seller_id': seller_id,
            'seller_nickname': raw_data.get('seller', {}).get('nickname', ''),
            'free_shipping': any(
                t.get('type') == 'fulfillment'
                for t in raw_data.get('tags', [])
            ),
            'listing_type': raw_data.get('listing_type_id', ''),
            'permalink': permalink,
            'thumbnail': thumbnail,
            'images': thumbnails[:10],
        }
    else:
        # HTML format
        title = raw_data.get('title', '')
        price_data = normalize_price(
            raw_data.get('price', 0),
            raw_data.get('currency', 'ARS')
        )
        brand = extract_brand(title)
        thumbnails = raw_data.get('thumbnails', [])

        return {
            'external_id': raw_data.get('id', ''),
            'title': normalize_title(title),
            'slug': generate_slug(title),
            'description': raw_data.get('description', ''),
            'category_id': source_category,
            'category_name': source_category,
            'subcategory_name': '',
            'status': 'published',
            'price': price_data['price'],
            'cost_price': price_data['price'],
            'original_price': price_data['original_price'],
            'currency': price_data['currency'],
            'dollar_rate': 0,
            'iva_pct': 21.0,
            'internal_tax_pct': 0.0,
            'markup_pct': 0.0,
            'brand': brand,
            'sku': raw_data.get('id', ''),
            'ean': None,
            'warranty': None,
            'provider': 'mercadolibre',
            'provider_store': 'minorista',
            'condition': normalize_condition(raw_data.get('condition', '')),
            'available_qty': 1,
            'sold_qty': raw_data.get('sold_quantity', 0),
            'rating': raw_data.get('reviews', {}).get('rating_average', 0),
            'reviews_count': 0,
            'seller_id': '',
            'seller_nickname': raw_data.get('seller_name', ''),
            'free_shipping': False,
            'listing_type': '',
            'permalink': '',
            'thumbnail': thumbnails[0] if thumbnails else '',
            'images': thumbnails[:10],
        }
