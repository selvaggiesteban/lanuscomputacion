"""
Image Manager: downloads ML images, converts to WebP, uploads to Cloudflare R2.
"""
import io
import os
import re
import hashlib
import logging
import unicodedata
from typing import Optional
from urllib.parse import urlparse

import httpx
import boto3
from botocore.config import Config
from PIL import Image

logger = logging.getLogger(__name__)

# WebP settings
WEBP_QUALITY = 85
MAX_IMAGE_WIDTH = 1200


def _get_r2_client():
    """Create S3-compatible client for Cloudflare R2."""
    return boto3.client(
        's3',
        endpoint_url=f"https://{os.getenv('R2_ACCOUNT_ID', '')}.r2.cloudflarestorage.com",
        aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID', ''),
        aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY', ''),
        config=Config(signature_version='s3v4'),
        region_name='auto',
    )


def _sanitize_filename(title: str) -> str:
    """Generate SEO-friendly filename from product title."""
    slug = title.lower()
    slug = unicodedata.normalize('NFKD', slug)
    slug = slug.encode('ascii', 'ignore').decode('ascii')
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[\s]+', '-', slug)
    slug = re.sub(r'-+', '-', slug)
    slug = slug.strip('-')
    return slug[:80]  # max length for SEO


def _convert_to_webp(image_bytes: bytes, max_width: int = MAX_IMAGE_WIDTH) -> bytes:
    """Convert image to WebP format with optimization."""
    img = Image.open(io.BytesIO(image_bytes))

    # Resize if too wide
    if max_width and img.width > max_width:
        ratio = max_width / img.width
        new_height = int(img.height * ratio)
        img = img.resize((max_width, new_height), Image.LANCZOS)

    # Convert RGBA to RGB (WebP doesn't handle transparency well for photos)
    if img.mode == 'RGBA':
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    buf = io.BytesIO()
    img.save(buf, format='WEBP', quality=WEBP_QUALITY, method=6)
    return buf.getvalue()


def download_image(url: str, client: httpx.Client) -> Optional[bytes]:
    """Download image from URL, return raw bytes."""
    try:
        resp = client.get(url, timeout=30, follow_redirects=True)
        if resp.status_code == 200 and len(resp.content) > 1000:
            return resp.content
        logger.warning(f"Image download failed: {resp.status_code}")
    except Exception as e:
        logger.warning(f"Image download error: {e}")
    return None


def upload_to_r2(
    image_bytes: bytes,
    product_slug: str,
    image_index: int = 0,
    category_slug: str = "uncategorized",
) -> Optional[str]:
    """
    Convert image to WebP and upload to R2.
    Returns public URL or None on failure.
    """
    try:
        # Convert to WebP
        webp_bytes = _convert_to_webp(image_bytes)

        # Generate SEO filename
        filename = f"{product_slug}" if image_index == 0 else f"{product_slug}-{image_index + 1}"
        key = f"products/{category_slug}/{filename}.webp"

        # Upload to R2
        r2 = _get_r2_client()
        bucket = os.getenv('R2_BUCKET_NAME', 'lanus-images')
        r2.put_object(
            Bucket=bucket,
            Key=key,
            Body=webp_bytes,
            ContentType='image/webp',
            CacheControl='public, max-age=31536000',
        )

        # Return public URL
        public_url = os.getenv('R2_PUBLIC_URL', 'https://images.lanuscomputacion.com')
        return f"{public_url}/{key}"

    except Exception as e:
        logger.error(f"R2 upload failed: {e}")
        return None


def process_product_images(
    image_urls: list[str],
    product_slug: str,
    category_slug: str,
    client: httpx.Client,
) -> list[str]:
    """
    Download all images for a product, convert to WebP, upload to R2.
    Returns list of public R2 URLs.
    """
    r2_urls = []

    for i, url in enumerate(image_urls[:5]):  # max 5 images
        if not url:
            continue

        # Download
        image_bytes = download_image(url, client)
        if not image_bytes:
            continue

        # Upload to R2
        r2_url = upload_to_r2(image_bytes, product_slug, i, category_slug)
        if r2_url:
            r2_urls.append(r2_url)
            logger.info(f"  Image {i + 1}: {r2_url}")

    return r2_urls


def create_alt_text(title: str, brand: str = "") -> str:
    """Generate SEO-optimized alt text for product image."""
    alt = title
    if brand and brand.upper() not in title.upper():
        alt = f"{title} - {brand}"
    return alt[:200]  # max length for SEO
