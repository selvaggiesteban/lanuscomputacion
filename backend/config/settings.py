import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "catalog.db"
EXPORTS_DIR = DATA_DIR / "exports"
IMAGES_DIR = DATA_DIR / "images"

ML_SITE_ID = "MLA"
ML_API_BASE = "https://api.mercadolibre.com"
ML_RATE_LIMIT = 8  # requests per second
ML_SEARCH_LIMIT = 50  # items per page (max 50)

OCR_LANG = "spa"
OCR_ENGINE = "paddle"  # "tesseract" | "paddle"

WEBP_QUALITY = 85
IMAGE_MAX_WIDTH = None  # None = keep original size

B2B_DEFAULT_DISCOUNT = 0.10
B2B_DEFAULT_MIN_QTY = 6

MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN", "")
MP_PUBLIC_KEY = os.getenv("MP_PUBLIC_KEY", "")
MP_TEST_MODE = os.getenv("MP_TEST_MODE", "true").lower() == "true"

BANK_CBUL = os.getenv("BANK_CBU", "0720039788000001113604")
BANK_ALIAS = os.getenv("BANK_ALIAS", "")
BANK_HOLDER = os.getenv("BANK_HOLDER", "Esteban Selvaggi")

SCRAPE_PRIORITIES = {
    "MLA1051": {"name": "Celulares y Teléfonos", "frequency_h": 12},
    "MLA1648": {"name": "Computación", "frequency_h": 12},
    "MLA1000": {"name": "Electrónica, Audio y Video", "frequency_h": 24},
    "MLA1144": {"name": "Consolas y Videojuegos", "frequency_h": 24},
    "MLA1039": {"name": "Cámaras y Accesorios", "frequency_h": 48},
}
