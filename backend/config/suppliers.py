"""
Configuración de proveedores (ELIT, Distecna, Solutionbox, etc.)
"""
import os

ELIT_CONFIG = {
    "name": "ELIT",
    "slug": "elit",
    "api_url": "https://clientes.elit.com.ar/v1/api/productos",
    "user_id": int(os.getenv("ELIT_USER_ID", "31341")),
    "token": os.getenv("ELIT_TOKEN", "7tmmibk2olt"),
    "csv_url": "https://clientes.elit.com.ar/v1/api/productos/csv",
    "meta_url": "https://clientes.elit.com.ar/v1/api/productos/meta",
    "currency": "USD",
    "page_size": 100,
    "store": "minorista",
    "default_iva": 10.5,
    "default_markup": 23.0,
    "rate_limit": 2,
}

DSTECNA_CONFIG = {
    "name": "Distecna",
    "slug": "distecna",
    "api_url": None,
    "store": "mayorista",
    "status": "pending_credentials",
}

SOLUTIONBOX_CONFIG = {
    "name": "Solutionbox",
    "slug": "solutionbox",
    "api_url": None,
    "store": "mayorista",
    "status": "pending_credentials",
}

AIR_CONFIG = {
    "name": "AIR Computers",
    "slug": "air",
    "api_url": None,
    "store": "mayorista",
    "status": "pending_credentials",
}

ALL_SUPPLIERS = [ELIT_CONFIG, DSTECNA_CONFIG, SOLUTIONBOX_CONFIG, AIR_CONFIG]

STORE_MAP = {
    "ELIT": "minorista",
    "Distecna": "mayorista",
    "Solutionbox": "mayorista",
    "AIR Computers": "mayorista",
}

MAYORISTA_SLUGS = ["distecna", "solutionbox", "air"]
MINORISTA_SLUGS = ["elit"]
