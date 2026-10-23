// Post-build: wrangler 4.x rechaza _routes.json con excludes exactos que caen
// dentro de un exclude con splat (ej. "/blog/cover.webp" bajo "/blog/*").
// El adapter de Astro los emite juntos; filtramos los exactos redundantes.
import { readFileSync, writeFileSync } from "node:fs";

const file = new URL("../dist/_routes.json", import.meta.url);
const routes = JSON.parse(readFileSync(file, "utf8"));

const splats = (routes.exclude ?? []).filter((r) => r.endsWith("/*"));
const prefixes = splats.map((s) => s.slice(0, -1));

const before = (routes.exclude ?? []).length;
routes.exclude = (routes.exclude ?? []).filter(
  (r) => !(prefixes.some((p) => r.startsWith(p) && r !== p + "*") && !r.endsWith("/*")),
);
const after = routes.exclude.length;

writeFileSync(file, JSON.stringify(routes, null, 2) + "\n");
console.log(`fix-routes: exclude ${before} -> ${after} (splat: ${splats.join(", ") || "ninguno"})`);
