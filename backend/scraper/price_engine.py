"""
Price Engine: calcula precio final de venta.
Formula:
  Precio USD → ARS (BCRA cotización)
  + IVA (10.5% default)
  + Impuesto Interno (configurable)
  + Margen de ganancia (23% default)
"""
from backend.scraper.bcra_client import get_dollar_rate


def calculate_selling_price(
    cost_price: float,
    currency: str = "USD",
    iva_pct: float = 10.5,
    internal_tax_pct: float = 0.0,
    markup_pct: float = 23.0,
    dollar_rate: float | None = None,
    margin_floor_pct: float = 0.0,
) -> dict:
    if currency == "USD":
        if dollar_rate is None:
            dollar_rate = get_dollar_rate()
        price_ars = cost_price * dollar_rate
    else:
        price_ars = cost_price

    price_with_tax = price_ars * (1 + iva_pct / 100)
    price_with_internal = price_with_tax * (1 + internal_tax_pct / 100)
    final_price = price_with_internal * (1 + markup_pct / 100)

    if margin_floor_pct > 0:
        floor_price = cost_price * (1 + margin_floor_pct / 100)
        final_price = max(final_price, floor_price)

    return {
        "cost_original": cost_price,
        "currency": currency,
        "dollar_rate": dollar_rate,
        "price_ars_base": round(price_ars, 2),
        "iva_pct": iva_pct,
        "internal_tax_pct": internal_tax_pct,
        "markup_pct": markup_pct,
        "final_price": round(final_price, 2),
    }


def calculate_price_from_elit(product: dict) -> dict:
    precio = float(product.get("precio", 0))
    moneda_code = product.get("moneda", 1)
    currency = "USD" if moneda_code == 2 else "ARS"
    iva = float(product.get("iva", 10.5))
    imp_interno = float(product.get("impuesto_interno", 0))
    cotizacion = float(product.get("cotizacion", 0))

    return calculate_selling_price(
        cost_price=precio,
        currency=currency,
        iva_pct=iva,
        internal_tax_pct=imp_interno,
        markup_pct=23.0,
        dollar_rate=cotizacion if cotizacion > 0 else None,
    )
