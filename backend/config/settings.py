import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "catalog.db"
EXPORTS_DIR = DATA_DIR / "exports"
IMAGES_DIR = DATA_DIR / "images"

# ML Configuration
ML_SITE_ID = "MLA"
ML_RATE_LIMIT = 2  # requests per second (conservative)
ML_SEARCH_LIMIT = 50  # items per page (max 50)

# OCR Configuration
OCR_LANG = "es"  # Spanish for PaddleOCR

# Image Configuration
WEBP_QUALITY = 85
IMAGE_MAX_WIDTH = 1200

# R2 Storage Configuration
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID", "")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY", "")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME", "lanus-images")
R2_PUBLIC_URL = os.getenv("R2_PUBLIC_URL", "https://images.lanuscomputacion.com")

# Shipping Configuration
SHIPPING_FLAT_RATE = 17000
SHIPPING_METHOD_NAME = "A convenir"

# NVIDIA NIM Configuration
NVIDIA_NIM_API_KEY = os.getenv("NVIDIA_NIM_API_KEY", "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")
NVIDIA_NIM_MODEL = "deepseek-ai/deepseek-v4.1-flash"
NVIDIA_NIM_BASE_URL = "https://integrate.api.nvidia.com/v1"

# Reporting Configuration
REPORT_RECIPIENT = "selvaggi.esteban@gmail.com"
REPORT_SCHEDULE = ["09:00", "17:00"]

# Scraper Limits
MAX_PRODUCTS_PER_CATEGORY = 500
MAX_PAGES_PER_CATEGORY = 15
SCRAPE_DELAY_SECONDS = 2

# Category URLs for scraping
ML_CATEGORIES = {
    # 5 main categories
    "celulares-telefonos": "https://www.mercadolibre.com.ar/c/celulares-y-telefonos",
    "camaras-accesorios": "https://www.mercadolibre.com.ar/c/camaras-y-accesorios",
    "consolas-videojuegos": "https://www.mercadolibre.com.ar/c/consolas-y-videojuegos",
    "computacion": "https://www.mercadolibre.com.ar/c/computacion",
    "electronica-audio-video": "https://www.mercadolibre.com.ar/c/electronica-audio-y-video",
    # 18 subcategories
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
