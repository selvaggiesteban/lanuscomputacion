"""
Cliente API BCRA para obtener cotización del dólar oficial.
https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD
"""
import time
import requests

_CACHE = {"rate": None, "timestamp": 0}
CACHE_TTL = 3600

BCRA_URL = "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD"


def get_dollar_rate() -> float:
    now = time.time()
    if _CACHE["rate"] and (now - _CACHE["timestamp"]) < CACHE_TTL:
        return _CACHE["rate"]

    try:
        resp = requests.get(BCRA_URL, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        if results:
            detalle = results[0].get("detalle", [])
            if detalle:
                rate = detalle[0].get("tipoCotizacion")
                if rate and rate > 0:
                    _CACHE["rate"] = float(rate)
                    _CACHE["timestamp"] = now
                    return _CACHE["rate"]
    except Exception as e:
        print(f"[BCRA] Error obteniendo cotización: {e}")

    fallback = 1200.0
    print(f"[BCRA] Usando cotización de respaldo: ${fallback}")
    return fallback
