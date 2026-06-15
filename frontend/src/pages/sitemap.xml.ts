import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.runtime.env.DB as D1Database;

  // Get all published products
  const { results: products } = await db.prepare(
    "SELECT slug, last_api_update FROM products WHERE status = 'published' ORDER BY last_api_update DESC"
  ).all<{ slug: string; last_api_update: string }>();

  // Get all categories
  const { results: categories } = await db.prepare(
    "SELECT slug FROM categories WHERE is_active = 1"
  ).all<{ slug: string }>();

  const baseUrl = "https://lanuscomputacion.com";
  const now = new Date().toISOString();

  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/categoria/todas</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/ofertas</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
`;

  // Add categories
  for (const cat of categories) {
    sitemap += `  <url>
    <loc>${baseUrl}/categoria/${cat.slug}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  }

  // Add products
  for (const product of products) {
    const lastmod = product.last_api_update
      ? new Date(product.last_api_update).toISOString()
      : now;
    sitemap += `  <url>
    <loc>${baseUrl}/producto/${product.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>
`;
  }

  sitemap += `</urlset>`;

  return new Response(sitemap, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
