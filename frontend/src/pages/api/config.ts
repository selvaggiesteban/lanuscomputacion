import type { APIRoute } from "astro";

// GET /api/config — configuración pública del storefront (sin datos sensibles).
export const GET: APIRoute = async ({ locals }) => {
  const DB = (locals as any).runtime?.env?.DB as D1Database | undefined;
  let shippingCost = 17000;
  try {
    const row = await DB?.prepare("SELECT value FROM app_config WHERE key = 'shipping_cost'").first<{ value: string }>();
    if (row?.value != null && row.value !== "") shippingCost = Number(row.value);
  } catch (e) {
    console.error("config read error:", e);
  }
  return new Response(JSON.stringify({ shipping_cost: shippingCost }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
};
