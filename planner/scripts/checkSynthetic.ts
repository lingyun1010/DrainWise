// Local pipeline check on the synthetic set (needs .local/synthetic-images, never committed).
// Prints how often readImage lands within one band and matches the damage type. NOT accuracy.
// Run: node --experimental-strip-types scripts/checkSynthetic.ts [dir] [--write ../web/lib/imageReadings.json]
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { CAMERA_NETS } from "../src/cameraNets.ts";
import { readImage, type ImageReading, type Pixels } from "../src/readImage.ts";

type Meta = {
  file: string;
  camera_id: string;
  kind: string;
  band: number | null;
  damage: string;
  region: number[] | null;
};
const args = process.argv.slice(2);
const wi = args.indexOf("--write");
const out = wi >= 0 ? args.splice(wi, 2)[1] : null;
const dir = args[0] ?? "../.local/synthetic-images";
const meta = JSON.parse(readFileSync(`${dir}/metadata.json`, "utf8")) as { images: Meta[] };
const load = (f: string): Pixels => {
  const p = PNG.sync.read(readFileSync(`${dir}/${f}`));
  return { width: p.width, height: p.height, data: p.data };
};
const cams = [...new Set(meta.images.map((m) => m.camera_id))];
let n = 0,
  bandOk = 0,
  bandN = 0,
  dmgOk = 0,
  cleanOk = 0;
const conf: Record<string, number> = {};
const bad: string[] = [];
const examples: Record<string, { file: string; truth: Meta; reading: ImageReading }> = {};
for (const cam of cams) {
  const imgs = meta.images.filter((m) => m.camera_id === cam);
  const ref = load(imgs.find((m) => m.kind === "reference")!.file);
  for (const m of imgs.filter((x) => x.kind !== "reference")) {
    const r = readImage(ref, load(m.file), CAMERA_NETS[cam]);
    n++;
    const truthDamage = m.damage === "none" ? (m.band! >= 7 ? "net_full" : "none") : m.damage;
    const dOk = r.damage === truthDamage;
    if (dOk) dmgOk++;
    const key = `${truthDamage}->${r.damage}`;
    conf[key] = (conf[key] ?? 0) + 1;
    if (m.damage === "none") {
      bandN++;
      if (r.band !== null && Math.abs(r.band - m.band!) <= 1) bandOk++;
      if (r.band !== null && r.band >= 7 === m.band! >= 7) cleanOk++;
    }
    if (!dOk && bad.length < 12) bad.push(`${m.file} truth ${truthDamage}/b${m.band} read ${r.damage}/b${r.band}`);
    {
      const want = {
        "cam-01": "b7",
        "cam-02": "b3",
        "cam-03": "b9",
        "cam-04": "net_broken",
        "cam-05": "b7",
        "cam-06": "net_fallen",
        "cam-07": "b8",
      }[cam];
      const tag = m.kind === "band" ? `b${m.band}` : m.damage;
      if (tag === want && !examples[cam]) examples[cam] = { file: m.file, truth: m, reading: r };
    }
  }
}
console.log(
  `images ${n}; damage matched ${dmgOk} (${((dmgOk / n) * 100).toFixed(0)}%); band within one ${bandOk}/${bandN}; needs-cleaning side ${cleanOk}/${bandN}`,
);
console.log(conf);
console.log(bad.join("\n"));
if (out) {
  const cameras = Object.fromEntries(
    Object.entries(examples).map(([cam, e]) => [
      cam,
      { file: e.file, truth: { band: e.truth.band, damage: e.truth.damage }, reading: e.reading },
    ]),
  );
  const doc = {
    data_source:
      "SYNTHETIC edits of 7 council sample photos, read by planner/src/readImage.ts. Not real camera readings.",
    note: "Prototype, no accuracy claim. Pipeline check only: counts below are on the synthetic set the generator made.",
    image_size: { width: 960, height: 720 },
    generated_at: new Date().toISOString(),
    pipeline_check: {
      images: n,
      damage_matched: dmgOk,
      band_within_one: bandOk,
      band_images: bandN,
      needs_cleaning_side_matched: cleanOk,
    },
    cameras,
  };
  writeFileSync(out, JSON.stringify(doc, null, 2) + "\n");
}
