export interface PricingResult {
  cost_original: number;
  currency: string;
  dollar_rate: number;
  price_ars_base: number;
  iva_pct: number;
  internal_tax_pct: number;
  markup_pct: number;
  final_price: number;
}

export function calculateSellingPrice(
  costPrice: number,
  currency: string = "USD",
  ivaPct: number = 10.5,
  internalTaxPct: number = 0,
  markupPct: number = 23,
  dollarRate: number | null = null,
): PricingResult {
  let priceArs: number;

  if (currency === "USD") {
    if (dollarRate === null || dollarRate <= 0) {
      dollarRate = 1450;
    }
    priceArs = costPrice * dollarRate;
  } else {
    priceArs = costPrice;
  }

  const priceWithTax = priceArs * (1 + ivaPct / 100);
  const priceWithInternal = priceWithTax * (1 + internalTaxPct / 100);
  const finalPrice = priceWithInternal * (1 + markupPct / 100);

  return {
    cost_original: costPrice,
    currency,
    dollar_rate: dollarRate,
    price_ars_base: Math.round(priceArs * 100) / 100,
    iva_pct: ivaPct,
    internal_tax_pct: internalTaxPct,
    markup_pct: markupPct,
    final_price: Math.round(finalPrice * 100) / 100,
  };
}

export function calculatePriceFromElit(product: Record<string, any>): PricingResult {
  const precio = Number(product.precio ?? 0);
  const monedaCode = Number(product.moneda ?? 1);
  const currency = monedaCode === 2 ? "USD" : "ARS";
  const iva = Number(product.iva ?? 10.5);
  const impInterno = Number(product.impuesto_interno ?? 0);
  const cotizacion = Number(product.cotizacion ?? 0);

  return calculateSellingPrice(
    precio,
    currency,
    iva,
    impInterno,
    23,
    cotizacion > 0 ? cotizacion : null,
  );
}
