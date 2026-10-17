// Cron trigger: llama al endpoint POST /api/digest del sitio (Pages) con
// Bearer DIGEST_TOKEN. Un reintento tras 15s si el primer intento falla.
export interface Env {
  DIGEST_TOKEN: string;
  TARGET_URL?: string;
}

const DEFAULT_TARGET = "https://lanuscomputacion.com/api/digest";

async function fire(env: Env): Promise<void> {
  const res = await fetch(env.TARGET_URL || DEFAULT_TARGET, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.DIGEST_TOKEN}`,
    },
    body: JSON.stringify({}),
  });
  const body = await res.text();
  console.log(`[digest] HTTP ${res.status}: ${body.slice(0, 2000)}`);
  if (!res.ok) throw new Error(`digest endpoint HTTP ${res.status}`);
}

export default {
  async scheduled(_event: ScheduledController, env: Env, ctx: WaitUntil): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          await fire(env);
        } catch (e) {
          console.error(`[digest] intento 1 falló: ${(e as Error).message}`);
          await new Promise((r) => setTimeout(r, 15000));
          await fire(env);
        }
      })()
    );
  },
};
