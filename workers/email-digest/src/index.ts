import { sendEmail, EmailEnv } from "../../../frontend/src/lib/email";

export interface Env extends EmailEnv {
  DB: D1Database;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    console.log("Running Email Digest Cron Trigger...");
    
    try {
      // 1. Fetch pending orders
      // Pending orders are those where status is 'pending'
      const { results } = await env.DB.prepare(
        "SELECT o.id, o.total_price, o.customer_name, o.customer_email, o.customer_phone, o.status, o.created_at, p.title as product_title " +
        "FROM orders o JOIN products p ON o.product_id = p.id " +
        "WHERE o.status = 'pending' " +
        "ORDER BY o.created_at DESC"
      ).all();

      if (!results || results.length === 0) {
        console.log("No pending orders found. Skipping digest.");
        return;
      }

      // 2. Format digest
      // Format: 1× [Product] ([ID]) — [Price], [Customer], [Email] / [Phone], [Status], [Date].
      const lines = results.map(order => {
        const date = new Date(order.created_at).toLocaleString("es-AR");
        return `1× ${order.product_title} (${order.id.slice(0, 8)}) — $${order.total_price.toLocaleString("es-AR")}, ${order.customer_name}, ${order.customer_email} / ${order.customer_phone}, ${order.status}, ${date}.`;
      }).join("\n");

      const subject = "Digest de Pedidos Pendientes - Lanús Computación";
      const body = "Hola, aquí tienes el resumen de los pedidos pendientes:\n\n" + lines;

      // 3. Send Email
      const result = await sendEmail(env, {
        to: "selvaggi.esteban@gmail.com", // Sending to the owner as a digest
        subject: subject,
        text: body
      });

      if (result.success) {
        console.log("Email digest sent successfully.");
      } else {
        console.error("Failed to send email digest:", result.error);
      }

    } catch (err) {
      console.error("Error in scheduled event:", err);
    }
  },
};
