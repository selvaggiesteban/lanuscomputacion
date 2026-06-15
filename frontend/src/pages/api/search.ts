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

  let sql = "SELECT * FROM products WHERE status = 'published'";
  let countSql = "SELECT COUNT(*) as total FROM products WHERE status = 'published'";
  const binds: any[] = [];
  const countBinds: any[] = [];

  if (q) {
    const searchClause = " AND (title LIKE ? OR brand LIKE ? OR ean LIKE ? OR sku LIKE ?)";
    sql += searchClause;
    countSql += searchClause;
    const term = `%${q}%`;
    binds.push(term, term, term, term);
    countBinds.push(term, term, term, term);
  }

  if (category) {
    const catClause = " AND (category_name = ? OR subcategory_name = ?)";
    sql += catClause;
    countSql += catClause;
    binds.push(category, category);
    countBinds.push(category, category);
  }

  if (brand) {
    const brandClause = " AND brand = ?";
    sql += brandClause;
    countSql += brandClause;
    binds.push(brand);
    countBinds.push(brand);
  }

  sql += " ORDER BY available_qty DESC, title ASC LIMIT ? OFFSET ?";
  binds.push(limit, offset);

  const { results: products } = await db.prepare(sql).bind(...binds).all<Product>();
  const { total } = await db.prepare(countSql).bind(...countBinds).first<{ total: number }>() ?? { total: 0 };

  return new Response(JSON.stringify({
    products: products ?? [],
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
