// Cliente HTTP de la API de Mercado Libre (OAuth + recursos).
// El tipo D1Database es el global que declara src/env.d.ts (runtime Cloudflare).

interface MeliToken {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

// Refrescamos con 10 minutos de margen antes del vencimiento.
const REFRESH_MARGIN_MS = 10 * 60 * 1000;

// Single-flight a nivel de módulo: dos requests concurrentes que detectan el
// token por vencer comparten la misma promesa de refresh (una sola llamada a
// /oauth/token, que además rota el refresh_token y dejaría la segunda invocación
// con un refresh_token ya invalidado).
let refreshPromise: Promise<string> | null = null;

export class MeliClient {
  private clientId: string;
  private clientSecret: string;
  private db: D1Database;

  constructor(db: D1Database, clientId: string, clientSecret: string) {
    this.db = db;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  async getAccessToken(): Promise<string> {
    const tokenRow = await this.db.prepare("SELECT * FROM meli_tokens WHERE id = 1").first<MeliToken>();
    if (!tokenRow) throw new Error("No Mercado Libre account connected.");
    if (!tokenRow.access_token) {
      throw new Error("Mercado Libre no está conectado todavía (access_token vacío).");
    }

    if (this.isExpiringSoon(tokenRow.expires_at)) {
      return this.refreshSingleFlight(tokenRow.refresh_token);
    }

    return tokenRow.access_token;
  }

  private isExpiringSoon(expiresAt: string): boolean {
    const expires = new Date(expiresAt).getTime();
    // Fecha vacía o ilegible → tratamos el token como vencido.
    if (Number.isNaN(expires)) return true;
    return Date.now() + REFRESH_MARGIN_MS > expires;
  }

  private refreshSingleFlight(refreshToken: string): Promise<string> {
    if (!refreshPromise) {
      refreshPromise = this.refreshAccessToken(refreshToken).finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }

  // Fuerza un refresh aunque el token guardado parezca vigente (tras un 401).
  private async forceRefresh(): Promise<string> {
    const tokenRow = await this.db.prepare("SELECT * FROM meli_tokens WHERE id = 1").first<MeliToken>();
    if (!tokenRow) throw new Error("No Mercado Libre account connected.");
    return this.refreshSingleFlight(tokenRow.refresh_token);
  }

  private async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`ML Token Refresh falló (HTTP ${response.status}): ${text.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };
    const expiresIn = Number(data.expires_in ?? 3600);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    await this.db.prepare(
      "UPDATE meli_tokens SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = datetime('now') WHERE id = 1"
    ).bind(data.access_token, data.refresh_token ?? refreshToken, expiresAt).run();

    return data.access_token;
  }

  async request<T>(endpoint: string, method: string = "GET", body?: unknown): Promise<T> {
    let token = await this.getAccessToken();
    let response = await this.rawRequest(endpoint, method, body, token);

    // Ante un 401 (token revocado/vencido) intentamos refresh UNA vez y
    // reintentamos la misma llamada.
    if (response.status === 401) {
      token = await this.forceRefresh();
      response = await this.rawRequest(endpoint, method, body, token);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`ML API Error ${response.status} en ${method} ${endpoint}: ${text.slice(0, 500)}`);
    }

    return (await response.json()) as T;
  }

  private rawRequest(endpoint: string, method: string, body: unknown, token: string): Promise<Response> {
    return fetch(`https://api.mercadolibre.com${endpoint}`, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined || body === null ? undefined : JSON.stringify(body),
    });
  }
}
