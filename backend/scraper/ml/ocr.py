"""
OCR Module: extracts product data from screenshots using PaddleOCR 2.x.
"""
import os
import re
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Set flags before importing Paddle
os.environ['FLAGS_use_mkldnn'] = '0'
os.environ['GLOG_minloglevel'] = '3'

# Lazy-load PaddleOCR (heavy import)
_ocr_engine = None


def _get_ocr():
    """Lazy-load PaddleOCR engine."""
    global _ocr_engine
    if _ocr_engine is None:
        from paddleocr import PaddleOCR
        _ocr_engine = PaddleOCR(use_angle_cls=False, lang='es', show_log=False)
    return _ocr_engine


def extract_text_from_screenshot(screenshot_bytes: bytes) -> list[dict]:
    """
    Run PaddleOCR on a screenshot, return all detected text lines with positions.
    Returns: [{'text': str, 'confidence': float, 'bbox': list, 'y_center': float, 'x_center': float}]
    """
    import cv2
    import numpy as np

    # Decode image from bytes
    nparr = np.frombuffer(screenshot_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        logger.error("Could not decode screenshot image")
        return []

    # Save to temp file for PaddleOCR
    temp_path = '_temp_ocr.png'
    try:
        cv2.imwrite(temp_path, img)

        ocr = _get_ocr()
        results = ocr.ocr(temp_path, cls=False)

        lines = []
        if results and results[0]:
            for line in results[0]:
                bbox = line[0]  # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
                text = line[1][0]
                confidence = line[1][1]

                # Calculate centers
                y_center = sum(p[1] for p in bbox) / 4
                x_center = sum(p[0] for p in bbox) / 4

                lines.append({
                    'text': text.strip(),
                    'confidence': confidence,
                    'bbox': bbox,
                    'y_center': y_center,
                    'x_center': x_center,
                })

        # Sort by vertical position (top to bottom)
        lines.sort(key=lambda l: l['y_center'])

        return lines

    except Exception as e:
        logger.error(f"OCR error: {e}")
        return []
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def extract_title(lines: list[dict], screenshot_height: int) -> Optional[str]:
    """Extract product title from OCR lines (usually top area, large text)."""
    # Title is typically in the top 35% of the screenshot
    title_area = screenshot_height * 0.35

    title_parts = []
    for line in lines:
        if line['y_center'] > title_area:
            break
        text = line['text']
        if len(text) < 5:
            continue
        if text.startswith('$') or text.startswith('ARS'):
            continue
        if any(skip in text.lower() for skip in ['envío', 'envio', 'gratis', 'calcular', 'agregar', 'comprar', 'compartir', 'mercado libre']):
            continue
        if line['confidence'] > 0.6:
            title_parts.append(text)

    if title_parts:
        # The longest line near the top is usually the title
        title_parts.sort(key=len, reverse=True)
        return title_parts[0]

    return None


def extract_price(lines: list[dict]) -> Optional[float]:
    """Extract price from OCR lines."""
    for line in lines:
        text = line['text'].strip()
        # Match $12.345 or $12,345 or $1.234.567
        match = re.search(r'\$\s*([\d\.]+)', text)
        if match:
            price_str = match.group(1).replace('.', '')
            try:
                price = float(price_str)
                if price > 0 and price < 10000000:
                    return price
            except ValueError:
                continue

        # Match ARS 12345
        match = re.search(r'ARS\s*([\d\.]+)', text)
        if match:
            price_str = match.group(1).replace('.', '')
            try:
                price = float(price_str)
                if price > 0 and price < 10000000:
                    return price
            except ValueError:
                continue

    return None


def extract_brand(lines: list[dict], title: str = "") -> Optional[str]:
    """Extract brand from OCR lines or title."""
    known_brands = [
        'ACER', 'HP', 'DELL', 'LENOVO', 'ASUS', 'MSI', 'GIGABYTE',
        'SAMSUNG', 'KINGSTON', 'CORSAIR', 'COOLER MASTER', 'LOGITECH',
        'RAZER', 'WD', 'SANDISK', 'EPSON', 'BROTHER', 'CANON',
        'PHILIPS', 'SONY', 'INTEL', 'AMD', 'NVIDIA', 'LEXAR',
        'ADATA', 'FORZA', 'CUDY', 'TP-LINK', 'TENDA', 'XIAOMI',
        'REDMI', 'MOTOROLA', 'APPLE', 'HUAWEI', 'OPEN', 'GENIUS',
        'SPLIT', 'PHOENIX', 'MAXPRINT', 'NOC', 'STORM', 'EVEREST',
        'SOLO', 'KIRK', 'PEACH', 'GABARIT', 'COLORFUL',
        'XFX', 'SAPPHIRE', 'POWER COLOR', 'EVGA', 'ZOTAC', 'INNO3D',
        'PNY', 'TEAMGROUP', 'CRUCIAL', 'SK HYNIX', 'TRANSCEND',
        'THERMALTAKE', 'NZXT', 'FRACTAL DESIGN', 'BE QUIET', 'NOCTUA',
        'ARCTIC', 'DEEPCOOL', 'GAMEMAX', 'REDRAGON', 'HALION', 'OEX',
        'GHIA', 'SENTRI', 'TECHNO', 'WIN', 'BULLDOG', 'GEFORCE',
        'RADEON', 'RYZEN', 'ATHLON', 'HAYLO', 'SILICON POWER', 'GSKILL',
        'ARCTIC COOLING', 'ID-COOLING', 'SILER',
    ]

    # Check title first
    if title:
        for brand in known_brands:
            if brand.lower() in title.lower():
                return brand

    # Check OCR lines
    for line in lines:
        text = line['text'].strip()
        for brand in known_brands:
            if text.upper() == brand or text.lower() == brand.lower():
                return brand.upper()
        # Check "Marca: X" pattern
        if 'marca' in text.lower():
            match = re.search(r'marca[:\s]*(.+)', text, re.IGNORECASE)
            if match:
                return match.group(1).strip().upper()

    return None


def extract_condition(lines: list[dict]) -> str:
    """Extract product condition from OCR lines."""
    for line in lines:
        text = line['text'].lower()
        if 'nuevo' in text or 'new' in text:
            return 'new'
        if 'usado' in text or 'used' in text:
            return 'used'
        if 'reacondicionado' in text or 'refurbished' in text:
            return 'refurbished'
    return 'new'


def extract_stock(lines: list[dict]) -> int:
    """Extract available stock from OCR lines."""
    for line in lines:
        text = line['text'].lower()
        if 'sin stock' in text or 'agotado' in text:
            return 0
        if 'ultimas unidades' in text or 'últimas unidades' in text:
            return 3
        if 'disponible' in text or 'stock' in text:
            match = re.search(r'(\d+)', line['text'])
            if match:
                return int(match.group(1))
            return 10
    return 1


def ocr_screenshot(screenshot_bytes: bytes) -> dict:
    """
    Full OCR pipeline: extract all product data from a screenshot.
    Returns dict with title, price, brand, condition, stock, and all raw lines.
    """
    lines = extract_text_from_screenshot(screenshot_bytes)

    if not lines:
        logger.warning("No text detected in screenshot")
        return {'title': None, 'price': None, 'raw_lines': []}

    # Get screenshot height from bbox
    max_y = max(p[1] for l in lines for p in l['bbox'])
    screenshot_height = max_y + 100

    title = extract_title(lines, screenshot_height)
    price = extract_price(lines)
    brand = extract_brand(lines, title or "")
    condition = extract_condition(lines)
    stock = extract_stock(lines)

    result = {
        'title': title,
        'price': price,
        'brand': brand,
        'condition': condition,
        'stock': stock,
        'raw_lines': [l['text'] for l in lines],
    }

    logger.info(f"OCR: title='{title}', price={price}, brand={brand}, condition={condition}")
    return result
