import type { APIRoute } from "astro";
import { getUserFromRequest, getJwtSecret } from "../../../lib/auth";

// This is a proxy endpoint because NVIDIA NIM requires a secret key
// that should not be exposed to the frontend.
// In a real Cloudflare Workers environment, we would use env.NVIDIA_API_KEY.

export const POST: APIRoute = async ({ locals, request }) => {
  const DB = locals.runtime?.env?.DB as D1Database;
  const jwtSecret = getJwtSecret(locals.runtime.env);
  const user = await getUserFromRequest(request, DB, jwtSecret);

  if (!user || !user.is_admin) {
    return new Response(JSON.stringify({ error: "No autorizado" }), { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), { status: 400 });
  }

  const { productId } = body;
  if (!productId) {
    return new Response(JSON.stringify({ error: "Falta productId" }), { status: 400 });
  }

  try {
    const product = await DB.prepare("SELECT title, description FROM products WHERE id = ?").bind(productId).first();
    if (!product) {
      return new Response(JSON.stringify({ error: "Producto no encontrado" }), { status: 404 });
    }

    const nvidiaApiKey = locals.runtime.env.NVIDIA_API_KEY;
    if (!nvidiaApiKey) {
      return new Response(JSON.stringify({ error: "API Key de NVIDIA no configurada en el servidor" }), { status: 500 });
    }

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${nvidiaApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-ai/deepseek-v4.1-flash",
        messages: [
          {
            role: "system",
            content: "You are a social media expert for an electronics store called 'Lanús Computación'. Create 3 engaging social media content ideas (Instagram post, Story, and X/Twitter) for the provided product. For each idea, provide: Format, Hook/Headline, Main body text, Suggested hashtags, and Visual suggestion. Return the response as a JSON array of objects."
          },
          {
            role: "user",
            content: `Product: ${product.title}\\nDescription: ${product.description}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `NVIDIA API error: ${errorText}` }), { status: response.status });
    }

    const data = await response.json();
    // NVIDIA NIM returns the JSON string inside the content field
    const content = data.choices[0].message.content;

    return new Response(content, {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (e: any) {
    console.error("Error generating AI content:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
