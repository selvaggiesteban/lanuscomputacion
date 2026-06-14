const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchCategories() {
  const res = await fetch(`${API_BASE}/api/categories`);
  return res.json();
}

export async function fetchProducts(params: {
  category?: string;
  limit?: number;
  offset?: number;
  sort?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.category) searchParams.set('category', params.category);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());
  if (params.sort) searchParams.set('sort', params.sort);

  const res = await fetch(`${API_BASE}/api/products?${searchParams}`);
  return res.json();
}

export async function fetchProduct(id: string) {
  const res = await fetch(`${API_BASE}/api/products/${id}`);
  return res.json();
}

export async function searchProducts(q: string, category?: string) {
  const params = new URLSearchParams({ q });
  if (category) params.set('category', category);
  const res = await fetch(`${API_BASE}/api/search?${params}`);
  return res.json();
}
