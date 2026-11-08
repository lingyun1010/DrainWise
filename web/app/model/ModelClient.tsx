"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { WATERWAYS } from "@/lib/geo";
import { makeSeedAssets } from "@/lib/seed";
import { heightAt, wx, wz } from "@/lib/terrain";

type Level = "low" | "medium" | "high";
type Pred = { asset_id: string; p_block: number; level: Level; reasons: string[] };
type Source = "model" | "rule";

const PUBLIC_BUILD = process.env.NEXT_PUBLIC_PUBLIC_BUILD === "1";
const HIGH_AT = 0.6;
const MEDIUM_AT = 0.3;
const FILL: Record<Level, string> = { high: "#FF8A4C", medium: "#FFD27A", low: "#4FC3E8" };
const MOUTH: Record<Level, string> = { high: "M-5 16 q5 -6 10 0", medium: "M-4 14 h8", low: "M-6 12 q6 7 12 0" };
const LABEL: Record<Level, string> = { high: "High (60%+)", medium: "Medium (30%+)", low: "Low" };
const levelFor = (p: number): Level => (p >= HIGH_AT ? "high" : p >= MEDIUM_AT ? "medium" : "low");

const SEED = makeSeedAssets();
const TERRAIN = SEED.map((a) => heightAt(wx(a.x), wz(a.y)));
const T_MIN = 0.3;
const T_MAX = 2.6;
// Colours are rounded to whole numbers so the server and the browser draw identical markup.
const TERRAIN_CELLS = Array.from({ length: 40 * 25 }, (_, i) => {
  const x = (i % 40) * 20;
  const y = Math.floor(i / 40) * 20;
  const t = Math.min(1, Math.max(0, (heightAt(wx(x + 10), wz(y + 10)) - T_MIN) / (T_MAX - T_MIN)));
  return { i, x, y, fill: `rgb(${Math.round(20 + t * 70)},${Math.round(60 + t * 70)},${Math.round(85 + t * 30)})` };
});
const terrainClass = (h: number) => (h < 0.9 ? "Low ground" : h < 1.6 ? "Mid slope" : "Higher ground");

// The made-up rule the sample data was generated from (ml/simulate.py). Used only when the live model is unreachable.
function ruleScore(a: (typeof SEED)[number], v: Vars): Pred {
  const canopy = (0.45 * a.canopyPct) / 70;
  const leaf = (0.35 * v.leaf) / 100;
  const rain = 0.2 * Math.min(1, v.rain / 80);
  const days = v.mode === "own" ? a.daysSinceClean : v.days;
  const age = 0.2 + 0.8 * Math.min(1, days / 150);
  const score = (canopy + leaf + rain) * age * 1.1;
  const p = 1 / (1 + Math.exp(-(score - 0.3) * 10));
  const parts: [number, string][] = [
    [canopy, "Heavy tree cover nearby"],
    [leaf, "High leaf-fall season"],
    [rain, "Heavy rain in the last 7 days"],
    [age * 0.5, `Last cleaned ${Math.round(days)} days ago`],
  ];
  const reasons = parts
    .sort((x, y) => y[0] - x[0])
    .slice(0, 3)
    .map((r) => r[1]);
  return { asset_id: a.id, p_block: p, level: levelFor(p), reasons };
}

type Vars = { rain: number; forecast: number; leaf: number; mode: "own" | "all"; days: number };
const DEFAULT: Vars = { rain: 20, forecast: 10, leaf: 60, mode: "own", days: 60 };
const PRESETS: { name: string; v: Vars }[] = [
  { name: "Quiet week", v: { rain: 5, forecast: 0, leaf: 20, mode: "own", days: 60 } },
  { name: "Default sample", v: DEFAULT },
  { name: "Leaf fall + storm", v: { rain: 60, forecast: 50, leaf: 90, mode: "own", days: 60 } },
  { name: "Everything cleaned today", v: { rain: 60, forecast: 50, leaf: 90, mode: "all", days: 0 } },
];

const card: React.CSSProperties = {
  background: "var(--fr-panel)",
  border: "3px solid var(--fr-line)",
  borderRadius: 24,
  padding: 20,
};
const eyebrow: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--fr-mute)",
  fontWeight: 700,
};
const h2: React.CSSProperties = { margin: "4px 0 8px", fontSize: 26, fontFamily: "var(--font-fredoka)" };
const soft: React.CSSProperties = { color: "var(--fr-soft)", fontSize: 15, lineHeight: 1.5, margin: "0 0 12px" };

function Section({ eb, title, children }: { eb: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ ...card, marginTop: 16 }}>
      <div style={eyebrow}>{eb}</div>
      <h2 style={h2}>{title}</h2>
      {children}
    </section>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone: "fixed" | "var" | "plan" | "done" }) {
  const c = { fixed: "#8FB8CC", var: "#FFD27A", plan: "#8FB8CC", done: "#7ED9A3" }[tone];
  return (
    <span
      style={{
        border: `2px solid ${c}`,
        color: c,
        borderRadius: 999,
        padding: "2px 10px",
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

const INPUTS: { name: string; tone: "fixed" | "var"; note: string; used: string }[] = [
  {
    name: "GPT positions",
    tone: "fixed",
    note: "36 sample GPTs placed 20 to 100 m from real creek lines (OpenStreetMap). Invented, not council assets.",
    used: "Map and run planner",
  },
  {
    name: "Terrain",
    tone: "fixed",
    note: "Procedural SAMPLE terrain, low near the creek. To be replaced by ELVIS LiDAR.",
    used: "Shown here. Not a model feature yet.",
  },
  {
    name: "Tree canopy",
    tone: "fixed",
    note: "Canopy % near each GPT (8 to 70). Sample values. Real source: NSW tree canopy 2024-25.",
    used: "Model feature",
  },
  {
    name: "Rain",
    tone: "var",
    note: "Rain in the last 7 days and the forecast (mm). Real source: BoM.",
    used: "Model feature",
  },
  { name: "Leaf fall", tone: "var", note: "Leaf-fall index 0 to 100 for the season.", used: "Model feature" },
  {
    name: "Time since clean",
    tone: "var",
    note: "Days since the last clean. Resets to 0 when a crew submits proof.",
    used: "Model feature",
  },
];

const PIPELINE: { step: string; what: string; where: string; tone: "done" | "plan" }[] = [
  {
    step: "1 Simulate",
    what: "Make 20,000 sample assets and label each blocked or not with an assumed rule. No real history exists yet.",
    where: "ml/simulate.py",
    tone: "done",
  },
  {
    step: "2 Train",
    what: "Gradient boosting with monotonic rules: more canopy, leaf fall, rain or days never lowers risk.",
    where: "ml/train.py",
    tone: "done",
  },
  {
    step: "3 Check",
    what: "A pipeline recovery check only. It shows training and loading work, not real accuracy.",
    where: "ml/evaluate.py",
    tone: "done",
  },
  {
    step: "4 Serve",
    what: "POST /predict returns p_block, level and top reasons for each asset.",
    where: "risk_api/main.py",
    tone: "done",
  },
  {
    step: "5 Real records",
    what: "Council history replaces step 1. The API contract stays the same.",
    where: "after 9 and 13 Nov",
    tone: "plan",
  },
  {
    step: "6 Time split",
    what: "Train on earlier months, test on later. Claim value only if it beats the formula and a days-since-clean rule.",
    where: "planned",
    tone: "plan",
  },
  {
    step: "7 Retrain",
    what: "Confirmed photo labels join the training set on a schedule.",
    where: "planned",
    tone: "plan",
  },
];

function Drop({
  x,
  y,
  level,
  scale,
  canopy,
  label,
}: {
  x: number;
  y: number;
  level: Level;
  scale: number;
  canopy: number;
  label: string;
}) {
  const ink = level === "high" ? "#2A1208" : "#0B2233";
  return (
    <g transform={`translate(${x},${y})`}>
      <title>{label}</title>
      <circle
        r={5 + canopy * 0.28}
        fill="#7ED9A3"
        opacity="0.16"
        stroke="#7ED9A3"
        strokeOpacity="0.4"
        strokeDasharray="3 3"
      />
      <g transform={`scale(${scale})`}>
        <path
          d="M0 -26 C11 -12 19 -3 19 8 a19 19 0 0 1 -38 0 C-19 -3 -11 -12 0 -26Z"
          fill={FILL[level]}
          stroke="#FFF3EA"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <circle cx="-6.5" cy="5" r="3.2" fill={ink} />
        <circle cx="6.5" cy="5" r="3.2" fill={ink} />
        <path d={MOUTH[level]} fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Slider({
  id,
  label,
  unit,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ opacity: disabled ? 0.45 : 1 }}>
      <label htmlFor={id} style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15 }}>
        <span>{label}</span>
        <span>
          {value} {unit}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#4FC3E8", minHeight: 32 }}
      />
    </div>
  );
}

export default function ModelClient() {
  const [v, setV] = useState<Vars>(DEFAULT);
  const [res, setRes] = useState<{ source: Source; preds: Pred[]; note?: string }>(() => ({
    source: "rule",
    preds: SEED.map((a) => ruleScore(a, DEFAULT)),
  }));
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    const rule = () => SEED.map((a) => ruleScore(a, v));
    if (PUBLIC_BUILD) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no live risk-api on the public build, so scores come from the local rule
      setRes({ source: "rule", preds: rule(), note: "Public demo: no live model server." });
      return;
    }
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            SEED.map((a) => ({
              asset_id: a.id,
              type: a.type,
              canopy_pct: a.canopyPct,
              leaf_index: v.leaf,
              rain_mm_7d: v.rain,
              rain_forecast_mm: v.forecast,
              days_since_clean: v.mode === "own" ? a.daysSinceClean : v.days,
              has_camera: a.hasCamera,
            })),
          ),
        });
        const data = await r.json();
        if (!r.ok || !Array.isArray(data)) throw new Error("bad reply");
        if (!stale) setRes({ source: "model", preds: data as Pred[] });
      } catch {
        if (!stale) setRes({ source: "rule", preds: rule(), note: "risk-api is not reachable." });
      }
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [v]);

  const byId = useMemo(() => new Map(SEED.map((a, i) => [a.id, { a, h: TERRAIN[i] }])), []);
  const ranked = useMemo(() => [...res.preds].sort((x, y) => y.p_block - x.p_block), [res.preds]);
  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const p of res.preds) c[p.level]++;
    return c;
  }, [res.preds]);
  const set = (patch: Partial<Vars>) => setV((o) => ({ ...o, ...patch }));
  const picked = sel ? res.preds.find((p) => p.asset_id === sel) : null;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px 48px", width: "100%" }}>
      <Link href="/" style={{ color: "var(--fr-blue)", fontWeight: 700 }}>
        ← Back to DrainWise
      </Link>
      <h1 style={{ margin: "8px 0 4px", fontSize: 34, fontFamily: "var(--font-fredoka)" }}>How the risk model works</h1>
      <p style={{ ...soft, maxWidth: 760 }}>
        What goes in, how photos and people check it, how the model is trained, and what happens to the 36 sample GPTs
        when you change the weather. <strong>All data on this page is sample data</strong>: no real council records have
        been used yet.
      </p>

      <Section eb="1 · Inputs" title="What the model sees">
        <p style={soft}>Three things stay fixed for every GPT. Three things change with the weather and the crew.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          {INPUTS.map((i) => (
            <div key={i.name} style={{ border: "2px solid var(--fr-line)", borderRadius: 16, padding: 14 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <strong>{i.name}</strong>
                <Chip tone={i.tone}>{i.tone === "fixed" ? "Fixed" : "Variable"}</Chip>
              </div>
              <p style={{ margin: "8px 0 6px", fontSize: 14, color: "var(--fr-soft)", lineHeight: 1.45 }}>{i.note}</p>
              <div style={{ fontSize: 13, color: "var(--fr-mute)" }}>{i.used}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section eb="2 · Validation" title="Photos and people check the model">
        <p style={soft}>
          Crews take a BEFORE photo, clean, then take an AFTER photo. The before photo is the model&apos;s test: did it
          say this drain was blocked, and was it?
        </p>
        <ol
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 10,
            padding: 0,
            margin: 0,
            listStyle: "none",
          }}
        >
          {[
            ["Crew photo", "BEFORE and AFTER photo, with time, GPS, crew and run."],
            ["Vision model suggests", "Blockage level 0 (clear) to 3 (blocked), a confidence and a short reason."],
            ["Person confirms", "A reviewer sets the final level. Only confirmed labels count."],
            ["Compare", "Confirmed level vs the risk the model gave that GPT before the visit."],
            ["Training label", "Confirmed before photos become labels for retraining. AFTER photos stay as evidence."],
          ].map(([t, d], i) => (
            <li key={t} style={{ border: "2px solid var(--fr-line)", borderRadius: 16, padding: 12 }}>
              <div style={{ color: "var(--fr-yellow)", fontWeight: 700, fontSize: 13 }}>Step {i + 1}</div>
              <strong>{t}</strong>
              <div style={{ fontSize: 14, color: "var(--fr-soft)", marginTop: 4, lineHeight: 1.4 }}>{d}</div>
            </li>
          ))}
        </ol>
        <p style={{ ...soft, marginTop: 12, marginBottom: 0 }}>
          Honest status: only 7 unlabelled sample photos exist, so no accuracy is claimed. Without an API key the
          suggestion is a labelled MOCK. Photos are checked for faces and number plates before any training use.{" "}
          <Link href="/review" style={{ color: "var(--fr-blue)", fontWeight: 700 }}>
            Try the review page
          </Link>
        </p>
      </Section>

      <Section eb="3 · Training" title="From sample data to a model, and what is still to come">
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {PIPELINE.map((p) => (
            <li
              key={p.step}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(110px, 140px) 1fr auto",
                gap: 12,
                alignItems: "center",
                border: `2px ${p.tone === "done" ? "solid" : "dashed"} var(--fr-line)`,
                borderRadius: 16,
                padding: "10px 14px",
              }}
            >
              <strong>{p.step}</strong>
              <span style={{ fontSize: 14, color: "var(--fr-soft)" }}>
                {p.what} <span style={{ color: "var(--fr-mute)" }}>({p.where})</span>
              </span>
              <Chip tone={p.tone}>{p.tone === "done" ? "Built" : "Planned"}</Chip>
            </li>
          ))}
        </ol>
        <p style={{ ...soft, marginTop: 12, marginBottom: 0 }}>
          The sample data was made with an assumed rule, so a model that matches it only proves the pipeline works. It
          is not evidence about real drains.
        </p>
      </Section>

      <Section eb="4 · Try it" title="Change the weather, see all 36 GPTs">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="fr-btn fr-sec"
              style={{ minHeight: 40, padding: "8px 16px", fontSize: 14 }}
              onClick={() => setV(p.v)}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 12,
          }}
        >
          <Slider
            id="rain"
            label="Rain, last 7 days"
            unit="mm"
            value={v.rain}
            min={0}
            max={80}
            onChange={(rain) => set({ rain })}
          />
          <Slider
            id="fc"
            label="Rain forecast"
            unit="mm"
            value={v.forecast}
            min={0}
            max={80}
            onChange={(forecast) => set({ forecast })}
          />
          <Slider
            id="leaf"
            label="Leaf fall"
            unit="/ 100"
            value={v.leaf}
            min={0}
            max={100}
            onChange={(leaf) => set({ leaf })}
          />
          <div>
            <Slider
              id="days"
              label="Days since clean"
              unit="days"
              value={v.days}
              min={0}
              max={180}
              disabled={v.mode === "own"}
              onChange={(days) => set({ days })}
            />
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, marginTop: 4 }}>
              <input
                type="checkbox"
                checked={v.mode === "all"}
                onChange={(e) => set({ mode: e.target.checked ? "all" : "own" })}
                style={{ width: 20, height: 20, accentColor: "#4FC3E8" }}
              />
              Same for every GPT (otherwise each keeps its own sample value)
            </label>
          </div>
        </div>

        <div
          role="status"
          style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}
        >
          {(["high", "medium", "low"] as Level[]).map((l) => (
            <span
              key={l}
              style={{ border: `3px solid ${FILL[l]}`, borderRadius: 999, padding: "6px 14px", fontWeight: 700 }}
            >
              {LABEL[l]}: {counts[l]}
            </span>
          ))}
          <span style={{ fontSize: 13, color: res.source === "model" ? "var(--fr-green)" : "var(--fr-yellow)" }}>
            {res.source === "model"
              ? "Live model (trained on sample data)"
              : `Approximation: the sample-data rule, not the trained model. ${res.note ?? ""}`}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
            alignItems: "start",
          }}
        >
          <div>
            <svg
              viewBox="0 0 800 500"
              role="img"
              aria-label="Map of 36 sample GPTs coloured by blockage risk over sample terrain"
              style={{ width: "100%", borderRadius: 16, border: "3px solid var(--fr-line)", background: "#0b2233" }}
            >
              {TERRAIN_CELLS.map((c) => (
                <rect key={c.i} x={c.x} y={c.y} width={20} height={20} fill={c.fill} />
              ))}
              {WATERWAYS.map((w, i) => (
                <polyline
                  key={i}
                  points={w.pts.map((p) => `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`).join(" ")}
                  fill="none"
                  stroke="#4FC3E8"
                  strokeWidth="3"
                  strokeLinejoin="round"
                  opacity="0.8"
                />
              ))}
              {SEED.map((a) => {
                const p = res.preds.find((q) => q.asset_id === a.id);
                if (!p) return null;
                return (
                  <g
                    key={a.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${a.id}, ${LABEL[p.level]} risk`}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSel(a.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel(a.id))}
                  >
                    <Drop
                      x={a.x}
                      y={a.y}
                      level={p.level}
                      scale={sel === a.id ? 0.9 : 0.6}
                      canopy={a.canopyPct}
                      label={`${a.id}: ${Math.round(p.p_block * 100)}%`}
                    />
                  </g>
                );
              })}
            </svg>
            <p style={{ fontSize: 12, color: "var(--fr-mute)", margin: "6px 0 0" }}>
              Frown = High, flat mouth = Medium, smile = Low (the list names each level). Green dashed circle = tree
              canopy near the GPT (bigger = more). Lighter background = higher ground (sample terrain). GPT and creek
              positions: sample data, basemap lines from OpenStreetMap.
            </p>
          </div>

          <div style={{ maxHeight: 520, overflow: "auto", border: "2px solid var(--fr-line)", borderRadius: 16 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <caption style={{ textAlign: "left", padding: "8px 10px", color: "var(--fr-mute)", fontSize: 12 }}>
                Ranked by chance of blocking. Click a row for details.
              </caption>
              <thead>
                <tr
                  style={{
                    textAlign: "left",
                    color: "var(--fr-mute)",
                    position: "sticky",
                    top: 0,
                    background: "var(--fr-panel)",
                  }}
                >
                  <th style={{ padding: "6px 10px" }}>GPT</th>
                  <th>Risk</th>
                  <th>Chance</th>
                  <th>Top reason</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((p) => (
                  <tr
                    key={p.asset_id}
                    onClick={() => setSel(p.asset_id)}
                    style={{
                      cursor: "pointer",
                      background: sel === p.asset_id ? "var(--fr-line)" : undefined,
                      borderTop: "1px solid var(--fr-line)",
                    }}
                  >
                    <td style={{ padding: "6px 10px", fontWeight: 700 }}>{p.asset_id}</td>
                    <td>
                      <span style={{ color: FILL[p.level], fontWeight: 700 }}>
                        {p.level[0].toUpperCase() + p.level.slice(1)}
                      </span>
                    </td>
                    <td>{Math.round(p.p_block * 100)}%</td>
                    <td style={{ color: "var(--fr-soft)" }}>{p.reasons[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {picked && (
          <div style={{ marginTop: 12, border: "2px solid var(--fr-line2)", borderRadius: 16, padding: 14 }}>
            <strong>
              {picked.asset_id} · {LABEL[picked.level]} · {Math.round(picked.p_block * 100)}% chance of blocking
            </strong>
            <div style={{ fontSize: 14, color: "var(--fr-soft)", marginTop: 6, lineHeight: 1.5 }}>
              Fixed: canopy {byId.get(picked.asset_id)?.a.canopyPct}%, {terrainClass(byId.get(picked.asset_id)?.h ?? 1)}{" "}
              (sample terrain),
              {byId.get(picked.asset_id)?.a.hasCamera ? " has a camera" : " no camera"}.
              <br />
              Why: {picked.reasons.join("; ")}.
            </div>
            <button type="button" className="fr-btn fr-ghost" style={{ minHeight: 40 }} onClick={() => setSel(null)}>
              Close details
            </button>
          </div>
        )}
        <p style={{ ...soft, marginTop: 12, marginBottom: 0 }}>
          Terrain is shown for context. The current model does not use it yet, so moving a GPT to lower ground would not
          change its score. Water level in the 3D view is an illustration, not a flood forecast.
        </p>
      </Section>
    </main>
  );
}
