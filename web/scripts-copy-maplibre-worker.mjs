// maplibre-gl 6 ships its worker as separate .mjs files. Turbopack cannot bundle them, so we serve them from /public.
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(`node_modules/maplibre-gl/dist/${f}`, `public/maplibre/${f}`);
}
