/**
 * Price mode utilities for Lanús Computación.
 *
 * Supported modes:
 *   - "mejor-precio"  → bank-transfer discount (transferencia directa)
 *   - "todos"         → standard credit-card price (all payment methods)
 *   - "usd"           → USD equivalent using dollar_rate
 *   - "ars"           → ARS (same as "todos")
 */

export type PriceMode = 'mejor-precio' | 'todos' | 'usd' | 'ars';

/** Bank-transfer discount percentage applied to the base price. */
export const TRANSFER_DISCOUNT_PCT = 10;

/**
 * Given a base ARS price and the current mode, return the display price
 * formatted for the UI. Also returns the currency symbol.
 */
export function computeDisplayPrice(
  basePrice: number,
  mode: PriceMode,
  dollarRate: number,
): { value: number; currency: string; symbol: string } {
  switch (mode) {
    case 'mejor-precio': {
      const discounted = Math.round(basePrice * (1 - TRANSFER_DISCOUNT_PCT / 100));
      return { value: discounted, currency: 'ARS', symbol: '$' };
    }
    case 'usd': {
      if (dollarRate > 0) {
        const usd = Math.round((basePrice / dollarRate) * 100) / 100;
        return { value: usd, currency: 'USD', symbol: 'U$S' };
      }
      return { value: basePrice, currency: 'ARS', symbol: '$' };
    }
    case 'todos':
    case 'ars':
    default:
      return { value: basePrice, currency: 'ARS', symbol: '$' };
  }
}

/**
 * Calculate the installment value for a given display price.
 */
export function computeInstallment(
  displayPrice: number,
  count: number,
): number {
  return Math.round(displayPrice / count);
}
