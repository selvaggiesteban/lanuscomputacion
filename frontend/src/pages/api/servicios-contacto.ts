import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request }) => {
  try {
    const { nombre, email, telefono, servicio, mensaje } = await request.json();

    if (!nombre || !email || !servicio || !mensaje) {
      return new Response(
        JSON.stringify({ ok: false, error: "Faltan campos obligatorios" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const whatsappMsg = `*Nueva solicitud de servicio*%0A%0A*Nombre:* ${nombre}%0A*Email:* ${email}%0A*Teléfono:* ${telefono || "No informado"}%0A*Servicio:* ${servicio}%0A%0A*Mensaje:*%0A${mensaje}`;
    const whatsappUrl = `https://wa.me/5491153323937?text=${whatsappMsg}`;

    return new Response(
      JSON.stringify({ ok: true, whatsappUrl }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Error interno del servidor" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
