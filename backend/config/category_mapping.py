"""
Translation layer for ELIT API categories to store categories.
"""

# Mapping from Elit API category names to Store category names.
# If a category is not found in this map, it will be assigned to 'Sin categoría'.
CATEGORY_MAPPING = {
    "Notebooks": "Notebooks",
    "Laptops": "Notebooks",
    "Celulares": "Celulares y Smartphones",
    "Smartphones": "Celulares y Smartphones",
    "Monitores": "Monitores",
    "Componentes": "Componentes de PC",
    "Placas de Video": "Componentes de PC",
    "Procesadores": "Componentes de PC",
    "Memorias RAM": "Componentes de PC",
    "Almacenamiento": "Almacenamiento",
    "Discos SSD": "Almacenamiento",
    "Discos HDD": "Almacenamiento",
    "Impresoras": "Impresión",
    "Tinta y Toners": "Impresión",
    "Auriculares": "Audio",
    "Parlantes": "Audio",
    "Teclados": "Periféricos de PC",
    "Mouses": "Periféricos de PC",
    "Consolas": "Consolas",
    "Juegos": "Videojuegos",
    "Accesorios": "Accesorios para Celulares",
}

def map_elit_category(elit_category: str) -> str:
    """
    Maps an ELIT API category name to a store category.
    Returns 'Sin categoría' if no match is found.
    """
    if not elit_category:
        return "Sin categoría"

    # Exact match first
    if elit_category in CATEGORY_MAPPING:
        return CATEGORY_MAPPING[elit_category]

    # Partial match (case-insensitive)
    cat_lower = elit_category.lower()
    for elit_name, store_name in CATEGORY_MAPPING.items():
        if elit_name.lower() in cat_lower:
            return store_name

    return "Sin categoría"
