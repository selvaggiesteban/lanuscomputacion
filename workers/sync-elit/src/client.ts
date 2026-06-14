export interface ElitClientConfig {
  apiUrl: string;
  userId: string;
  token: string;
  pageLimit: number;
}

export class ElitClient {
  private config: ElitClientConfig;

  constructor(config: ElitClientConfig) {
    this.config = config;
  }

  async getProducts(limit: number = 100, offset: number = 1): Promise<any[]> {
    const params = new URLSearchParams({
      limit: String(Math.min(limit, 100)),
      offset: String(Math.max(offset, 1)),
    });

    const url = `${this.config.apiUrl}?${params.toString()}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: this.config.userId,
        token: this.config.token,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[ELIT] HTTP ${response.status}: ${text.slice(0, 200)}`);
      return [];
    }

    const data: any = await response.json();

    if (Array.isArray(data)) return data;
    if (data?.resultado && Array.isArray(data.resultado)) return data.resultado;
    if (data?.productos && Array.isArray(data.productos)) return data.productos;
    if (data?.data && Array.isArray(data.data)) return data.data;

    return [];
  }

  async getAllProducts(maxProducts?: number): Promise<any[]> {
    const allProducts: any[] = [];
    let offset = 1;
    const limit = this.config.pageLimit;

    while (true) {
      const batch = await this.getProducts(limit, offset);
      if (batch.length === 0) break;

      allProducts.push(...batch);
      console.log(`[ELIT] offset=${offset}, got ${batch.length} (total: ${allProducts.length})`);

      if (maxProducts !== undefined && allProducts.length >= maxProducts) break;
      if (batch.length < limit) break;

      offset += limit;
    }

    return allProducts;
  }
}
