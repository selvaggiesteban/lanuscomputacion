import { MeliClient } from '../../frontend/src/lib/meli';
import { sendEmail } from '../../frontend/src/lib/email';

export default {
  async scheduled(event, env, ctx) {
    console.log("Generating ML Daily Digest...");
    
    try {
      const now = new Date();
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString();
      
      const events = await env.DB.prepare(
        "SELECT * FROM meli_events WHERE created_at >= ? ORDER BY created_at DESC"
      ).bind(twelveHoursAgo).all();

      if (events.results.length === 0) {
        console.log("No ML events to report.");
        return;
      }

      const report = events.results.map(e => `[${e.created_at}] ${e.event_type}: ${e.item_id} - ${e.payload}`).join('\n');
      
      await sendEmail(env, {
        to: 'esteban@lanuscomputacion.com', // Replace with actual owner email
        subject: `Resumen de Eventos Mercado Libre - ${now.toLocaleDateString()}`,
        body: `Hola Esteban,\n\nAquí tienes el resumen de actividad de Mercado Libre desde las últimas 12 horas:\n\n${report}\n\nSaludos,\nBot de Sincronización ML.`,
      });

      console.log("ML Digest email sent.");
    } catch (e) {
      console.error("ML Digest failed:", e);
    }
  },
};
