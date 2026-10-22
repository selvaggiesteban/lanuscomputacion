import { type D1Database } from 'cloudflare:workers';

interface MeliToken {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

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

    const now = new Date();
    const expiresAt = new Date(tokenRow.expires_at);

    // Refresh if token expires in less than 10 minutes
    if (now.getTime() + 10 * 60 * 1000 > expiresAt.getTime()) {
      return this.refreshAccessToken(tokenRow.refresh_token);
    }

    return tokenRow.access_token;
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
      const error = await response.json();
      throw new Error(`ML Token Refresh Failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();

    await this.db.prepare(
      "UPDATE meli_tokens SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = datetime('now') WHERE id = 1"
    ).bind(data.access_token, data.refresh_token, expiresAt).run();

    return data.access_token;
  }

  async request<T>(endpoint: string, method: string = "GET", body?: any): Promise<T> {
    const token = await this.getAccessToken();
    const response = await fetch(`https://api.mercadolibre.com${endpoint}`, {
      method,
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ML API Error (${response.status}): ${JSON.stringify(error)}`);
    }

    return response.json();
  }
}
