import type { APIRoute } from "astro";
import type { Product } from "../../lib/d1";

export const GET: APIRoute = async ({ locals, request }) => {
  const db = locals.runtime.env.DB as D1Database;
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const category = url.searchParams.get("category") || "";
  const brand = url.searchParams.get("brand") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
  const offset = (page - 1) * limit;

  let sql =
    "SELECT *, COUNT(*) OVER() AS total_count FROM products WHERE status = 'published'";
  const binds: any[] = [];

  if (q) {
    sql += " AND (title LIKE ? OR brand LIKE ? OR ean LIKE ? OR sku LIKE ?)";
    const term = `%${q}%`;
    binds.push(term, term, term, term);
  }

  if (category) {
    sql += " AND category_id = ?";
    binds.push(category);
  }

  if (brand) {
    sql += " AND brand = ?";
    binds.push(brand);
  }

  sql += " ORDER BY available_qty DESC, title ASC LIMIT ? OFFSET ?";
  binds.push(limit, offset);

  // Single pass: rows + total via window count (halves D1 rows read per search)
  const { results: rows } = await db
    .prepare(sql)
    .bind(...binds)
    .all<Product & { total_count: number }>();
  const products = rows ?? [];
  const total = products.length > 0 ? products[0].total_count : 0;

  return new Response(JSON.stringify({
    products: products.map(({ total_count: _tc, ...product }) => product),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
