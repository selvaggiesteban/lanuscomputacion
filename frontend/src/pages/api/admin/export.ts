import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../../lib/auth";

export const GET: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime.env.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);

  const user = await getUserFromRequest(request, DB, jwtSecret);
  if (!user || user.is_admin !== 1) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { "Content-Type": "application/json" } });
  }

  const type = new URL(request.url).searchParams.get("type") || "products";

  if (type === "products") {
    let results = [];
    try {
      const { results: dbResults } = await DB.prepare(
        "SELECT id, title, brand, ean, price, available_qty, category_name, subcategory_name, provider_store, status, created_at FROM products ORDER BY created_at DESC"
      ).all();
      results = dbResults;
    } catch (e) {
      console.error("D1 Error in frontend/src/pages/api/admin/export.ts:", e);
    }

    const header = "ID,Título,Marca,EAN,Precio,Stock,Categoría,Subcategoría,Tienda,Estado,Fecha\n";
    const rows = (results || []).map((p: any) =>
      `${p.id},"${(p.title || "").replace(/"/g, '""')}",${p.brand || ""},${p.ean || ""},${p.price},${p.available_qty},"${p.category_name || ""}","${p.subcategory_name || ""}","${p.provider_store || ""}",${p.status},${p.created_at}`
    ).join("\n");

    return new Response(header + rows, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="productos_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  if (type === "orders") {
    let results = [];
    try {
      const { results: dbResults } = await DB.prepare(
        "SELECT id, customer_name, customer_email, customer_phone, total, status, payment_method, mp_payment_id, created_at, updated_at FROM orders ORDER BY created_at DESC"
      ).all();
      results = dbResults;
    } catch (e) {
      console.error("D1 Error in frontend/src/pages/api/admin/export.ts:", e);
    }

    const header = "ID,Cliente,Email,Teléfono,Total,Estado,Método Pago,MP Payment ID,Fecha Creación,Última Actualización\n";
    const rows = (results || []).map((o: any) =>
      `${o.id},"${(o.customer_name || "").replace(/"/g, '""')}",${o.customer_email || ""},${o.customer_phone || ""},${o.total},${o.status},${o.payment_method || ""},${o.mp_payment_id || ""},${o.created_at},${o.updated_at || ""}`
    ).join("\n");

    return new Response(header + rows, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="ordenes_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return new Response(JSON.stringify({ error: "Tipo inválido. Usar: products, orders" }), { status: 400, headers: { "Content-Type": "application/json" } });
};
