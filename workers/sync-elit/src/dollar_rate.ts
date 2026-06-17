/**
 * Dollar rate provider — modular design for multiple sources.
 *
 * Currently supports:
 *   - BCRA official exchange rate (Estadísticas Cambiarias v1.0)
 *
 * Usage:
 *   const rate = await getDollarRate();
 */

const BCRA_URL = "https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones/USD";
const FALLBACK_RATE = 1200;

export interface DollarRateResult {
  rate: number;
  source: "bcra" | "fallback";
  fetchedAt: string;
}

/**
 * Fetch the official USD/ARS rate from BCRA (Estadísticas Cambiarias v1.0).
 */
async function fetchBcraRate(): Promise<DollarRateResult> {
  try {
    const resp = await fetch(BCRA_URL, {
      headers: { Accept: "application/json" },
    });

    if (!resp.ok) {
      console.warn(`[dollar_rate] BCRA HTTP ${resp.status}`);
      return { rate: FALLBACK_RATE, source: "fallback", fetchedAt: new Date().toISOString() };
    }

    const data = await resp.json() as {
      results?: Array<{ detalle?: Array<{ tipoCotizacion?: number }> }>
    };
    const cotizacion = data?.results?.[0]?.detalle?.[0]?.tipoCotizacion;

    if (typeof cotizacion === "number" && cotizacion > 0) {
      return { rate: cotizacion, source: "bcra", fetchedAt: new Date().toISOString() };
    }

    console.warn("[dollar_rate] BCRA returned no valid rate");
    return { rate: FALLBACK_RATE, source: "fallback", fetchedAt: new Date().toISOString() };
  } catch (err) {
    console.error("[dollar_rate] BCRA fetch error:", err);
    return { rate: FALLBACK_RATE, source: "fallback", fetchedAt: new Date().toISOString() };
  }
}

/**
 * Get dollar rate from the best available source.
 * Extend this function to add more providers in the future.
 */
export async function getDollarRate(): Promise<DollarRateResult> {
  return fetchBcraRate();
}
