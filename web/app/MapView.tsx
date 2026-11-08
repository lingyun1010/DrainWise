import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import BaseMap, { type View } from "./BaseMap";
import { MAP_H, MAP_W, WATERWAYS } from "@/lib/geo";
import { DEPOT } from "@/lib/seed";

export type Level = "low" | "medium" | "high";
export type MapAsset = {
  id: string;
  type: "inlet" | "gpt";
  typeLabel: string;
  x: number;
  y: number;
  hasCamera: boolean;
  level: Level;
  state: "idle" | "busy" | "done";
  planN?: number; // stop number in the proposed run
  crewColor?: string; // set while a crew is assigned to this asset
  crewLetter?: string;
  pct?: number; // blockage risk in percent (sample model), for the hover card
  daysSinceClean?: number;
};
export type MapRoute = { name: string; color: string; ids: string[] };
export type MapCrew = {
  id?: string;
  name: string;
  hat: string;
  letter: string;
  x: number;
  y: number;
  working: boolean;
};

const FILL: Record<Level, string> = { high: "#FF8A4C", medium: "#FFD27A", low: "#4FC3E8" };
const MOUTH: Record<Level, string> = { high: "M-5 16 q5 -6 10 0", medium: "M-4 14 h8", low: "M-6 12 q6 7 12 0" };
const LEAVES = "q8 -6 12 2 q-8 8 -12 -2Z";
const WATER_PATHS = WATERWAYS.map((w, i) => ({
  key: `${i}-${w.name}`,
  river: w.kind === "river",
  d: "M" + w.pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" L"),
}));

export default function MapView({
  assets,
  route,
  routes = [],
  crews,
  hiddenCrews = [],
  onToggleCrew,
  onOpen,
}: {
  assets: MapAsset[];
  route: string[];
  routes?: MapRoute[];
  hiddenCrews?: string[]; // crew ids whose rings and routes are hidden
  onToggleCrew?: (id: string) => void;
  crews: MapCrew[];
  onOpen: (id: string) => void;
}) {
  // Pan and zoom: the overlay is drawn in map units; this moves and scales it to follow the basemap.
  const [view, setViewRaw] = useState<View>({ tx: 0, ty: 0, s: 1, w: 800, h: 500 });
  const box = useRef<HTMLDivElement>(null);
  const exitBtn = useRef<HTMLButtonElement>(null);
  const [full, setFull] = useState(false); // map fills the window (in this page, no navigation)
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("[role=dialog]")) setFull(false); // Esc closes an open dialog first
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("fr-map-full"); // lifts the map column above the other columns
    exitBtn.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      document.body.classList.remove("fr-map-full");
    };
  }, [full]);
  // Hover card: marker position in viewport pixels. It is drawn in document.body so the map box cannot clip it.
  const [tip, setTip] = useState<{ id: string; x: number; top: number; bottom: number } | null>(null);
  const setView = (v: View) => {
    setViewRaw(v);
    setTip(null);
  };
  const showTip = (id: string, el: Element) => {
    const r = el.getBoundingClientRect();
    setTip({ id, x: r.left + r.width / 2, top: r.top, bottom: r.bottom });
  };
  useEffect(() => {
    if (!tip) return;
    const clear = () => setTip(null);
    window.addEventListener("scroll", clear, { capture: true, once: true });
    return () => window.removeEventListener("scroll", clear, { capture: true });
  }, [tip]);
  const s = view.s;
  const T = `translate(${view.tx.toFixed(2)},${view.ty.toFixed(2)}) scale(${s.toFixed(4)})`;
  // Markers grow a little when zoomed in, but not as fast as the map.
  const cs = (0.73 * Math.min(Math.max(Math.pow(s / 0.73, 0.35), 0.7), 1.9)) / s;
  const byId = new Map(assets.map((a) => [a.id, a]));
  const stops = route.map((id) => byId.get(id)).filter((a): a is MapAsset => !!a);
  const pts = stops.length ? [DEPOT, ...stops, DEPOT].map((p) => `${p.x},${p.y}`).join(" ") : "";
  const crewPts = routes
    .map((r) => ({
      ...r,
      pts: [DEPOT, ...r.ids.map((id) => byId.get(id)).filter((a): a is MapAsset => !!a), DEPOT]
        .map((p) => `${p.x},${p.y}`)
        .join(" "),
    }))
    .filter((r) => r.ids.length > 0);
  const sorted = [...assets].sort((p, q) => order(p) - order(q)); // planned stops last, then high risk (on top)

  return (
    <div
      style={
        full
          ? { position: "fixed", inset: 0, zIndex: 15, display: "flex", flexDirection: "column", background: "#0B2233" }
          : undefined
      }
    >
      <div
        ref={box}
        style={{
          position: "relative",
          ...(full ? { flex: 1, minHeight: 0 } : { aspectRatio: `${MAP_W} / ${MAP_H}` }),
          borderRadius: full ? 0 : "22px 22px 0 0",
          border: "2px solid #1E4A63",
          borderBottom: 0,
          background: "#12384F",
          overflow: "hidden",
        }}
      >
        <BaseMap onView={setView} />
        <button
          ref={exitBtn}
          type="button"
          className="fr-btn fr-sec"
          aria-pressed={full}
          onClick={() => setFull((f) => !f)}
          style={{ position: "absolute", left: 10, top: 10, minHeight: 40, zIndex: 10 }}
        >
          {full ? "Exit full screen" : "Full screen"}
        </button>
        <svg
          viewBox={`0 0 ${view.w} ${view.h}`}
          width="100%"
          height="100%"
          role="img"
          aria-label="Map of central Parramatta with its creeks, a sample depot and sample gross pollutant traps coloured and shaped by blockage risk. Select a marker for details."
          style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none" }}
        >
          <g transform={T}>
            {WATER_PATHS.map((w) => (
              <path
                key={w.key}
                d={w.d}
                fill="none"
                stroke="#2F8FB5"
                strokeWidth={(w.river ? 5 : 3) / s}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
              />
            ))}
          </g>

          <g transform={`scale(${view.w / MAP_W})`}>
            <g aria-hidden="true" opacity="0.55">
              <g className="fr-fall">
                <path
                  d={["M90 20", "M260 0", "M420 30", "M580 10", "M720 25"].map((m) => m + " " + LEAVES).join(" ")}
                  fill="#FF8A4C"
                />
              </g>
              <g className="fr-fall" style={{ animationDelay: "-1.6s" }}>
                <path
                  d={["M30 70", "M180 50", "M340 60", "M500 45", "M650 65"].map((m) => m + " " + LEAVES).join(" ")}
                  fill="#FFD27A"
                />
              </g>
            </g>

            <g transform="translate(110,52)" aria-hidden="true">
              <g className="fr-bob">
                <circle cx="-26" cy="4" r="18" fill="#EAF6FB" />
                <circle cx="0" cy="-6" r="24" fill="#EAF6FB" />
                <circle cx="28" cy="4" r="18" fill="#EAF6FB" />
                <rect x="-44" y="4" width="90" height="18" rx="9" fill="#EAF6FB" />
                <circle cx="-8" cy="4" r="3.2" fill="#0B2233" />
                <circle cx="10" cy="4" r="3.2" fill="#0B2233" />
                <path d="M-6 12 q5 5 10 0" fill="none" stroke="#0B2233" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="-16" cy="11" r="4" fill="#FFB38A" opacity=".7" />
                <circle cx="18" cy="11" r="4" fill="#FFB38A" opacity=".7" />
              </g>
            </g>
          </g>
          <g transform={T}>
            <g transform={`translate(${DEPOT.x},${DEPOT.y}) scale(${cs})`}>
              <path
                d="M-40 -24 L0 -50 L40 -24 Z"
                fill="#FF8A4C"
                stroke="#FF8A4C"
                strokeWidth="8"
                strokeLinejoin="round"
              />
              <rect x="-34" y="-26" width="68" height="52" rx="14" fill="#1E4A63" stroke="#4FC3E8" strokeWidth="3" />
              <text
                x="0"
                y="6"
                textAnchor="middle"
                fontFamily="Nunito, sans-serif"
                fontWeight="800"
                fontSize="14"
                fill="#EAF6FB"
              >
                Depot
              </text>
            </g>

            {pts && (
              <polyline
                points={pts}
                fill="none"
                stroke="#EAF6FB"
                strokeWidth={2.2 / s}
                strokeDasharray={`${6 / s} ${6 / s}`}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.35"
              />
            )}
            {crewPts.map((r) => (
              <polyline
                key={r.name}
                points={r.pts}
                fill="none"
                stroke={r.color}
                strokeWidth={3.3 / s}
                strokeDasharray={`${7 / s} ${5 / s}`}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.95"
              />
            ))}

            {sorted.map((a) => {
              const done = a.state === "done";
              const busy = a.state === "busy";
              const sc = a.level === "high" && !done ? 0.95 : a.level === "medium" ? 0.75 : 0.58;
              const fill = done || a.level === "low" ? "#4FC3E8" : FILL[a.level];
              const ink = a.level === "high" && !done ? "#2A1208" : "#0B2233";
              const mouth = done ? MOUTH.low : MOUTH[a.level];
              const showN = !done && !busy && a.planN;
              const badge = done || busy || !!showN;
              return (
                <g
                  key={a.id}
                  className="fr-mk"
                  role="button"
                  tabIndex={0}
                  aria-label={`${a.id}, ${a.typeLabel}, ${done ? "Low" : cap(a.level)} blockage risk${a.hasCamera ? ", has a camera" : ""}${done ? ", cleaned" : busy ? ", crew assigned" : ""}`}
                  transform={`translate(${a.x},${a.y}) scale(${sc * cs})`}
                  pointerEvents="auto"
                  onClick={() => onOpen(a.id)}
                  onMouseEnter={(e) => showTip(a.id, e.currentTarget)}
                  onMouseLeave={() => setTip(null)}
                  onFocus={(e) => showTip(a.id, e.currentTarget)}
                  onBlur={() => setTip(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(a.id);
                    }
                  }}
                >
                  <g className="fr-mk-in">
                    <circle className="fr-mk-ring" r="33" fill="none" stroke="#EAF6FB" strokeWidth="3.5" />
                    {a.level === "high" && a.state === "idle" && (
                      <circle r="22" className="fr-pulse" fill="#FF8A4C" opacity="0.5" />
                    )}
                    {a.crewColor && <circle r="29" fill="none" stroke={a.crewColor} strokeWidth="5" />}
                    <path
                      d="M0 -26 C11 -12 19 -3 19 8 a19 19 0 0 1 -38 0 C-19 -3 -11 -12 0 -26Z"
                      fill={fill}
                      stroke="#FFF3EA"
                      strokeWidth="3.5"
                      strokeLinejoin="round"
                    />
                    <circle cx="-6.5" cy="5" r="3.2" fill={ink} />
                    <circle cx="6.5" cy="5" r="3.2" fill={ink} />
                    <path d={mouth} fill="none" stroke={ink} strokeWidth="2.6" strokeLinecap="round" />
                    {a.hasCamera && (
                      <g transform="translate(-16,-14)">
                        <circle r="11" fill="#0B2233" stroke="#EAF6FB" strokeWidth="2" />
                        <rect x="-6.5" y="-4.5" width="9" height="9" rx="2.5" fill="#4FC3E8" />
                        <path d="M3 -1.5 L7 -4 V4 L3 1.5Z" fill="#4FC3E8" strokeLinejoin="round" />
                        <circle cx="-2" cy="0" r="2" fill="#0B2233" />
                      </g>
                    )}
                    {a.crewColor && (
                      <g transform="translate(19,17)">
                        <circle r="9.5" fill={a.crewColor} stroke="#0B2233" strokeWidth="2" />
                        <text
                          y="4"
                          textAnchor="middle"
                          fontFamily="Nunito, sans-serif"
                          fontWeight="800"
                          fontSize="12"
                          fill="#0B2233"
                        >
                          {a.crewLetter}
                        </text>
                      </g>
                    )}
                    {badge && (
                      <>
                        <circle
                          cx="15"
                          cy="-14"
                          r="10"
                          fill={done ? "#FFFFFF" : busy ? "#FFD27A" : "#EAF6FB"}
                          stroke="#0B2233"
                          strokeWidth="2.5"
                        />
                        {done && (
                          <path
                            d="M10 -14 l3.5 3.5 l7 -8"
                            fill="none"
                            stroke="#0B2233"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                        {busy && (
                          <>
                            <circle cx="10" cy="-14" r="1.8" fill="#0B2233" />
                            <circle cx="15" cy="-14" r="1.8" fill="#0B2233" />
                            <circle cx="20" cy="-14" r="1.8" fill="#0B2233" />
                          </>
                        )}
                        {showN && (
                          <text
                            x="15"
                            y="-9.5"
                            textAnchor="middle"
                            fontFamily="Nunito, sans-serif"
                            fontWeight="800"
                            fontSize="14"
                            fill="#0B2233"
                          >
                            {a.planN}
                          </text>
                        )}
                      </>
                    )}
                  </g>
                </g>
              );
            })}

            {crews.map((c) => (
              <g
                key={c.name}
                transform={`translate(${c.x.toFixed(1)},${c.y.toFixed(1)}) scale(${cs})`}
                aria-label={c.name}
              >
                <circle r="15" fill="#FFE0C2" stroke="#0B2233" strokeWidth="3" />
                <circle cx="-4.5" cy="2" r="2" fill="#0B2233" />
                <circle cx="4.5" cy="2" r="2" fill="#0B2233" />
                <path d="M-4 7 q4 4 8 0" fill="none" stroke="#0B2233" strokeWidth="2" strokeLinecap="round" />
                <circle cx="-9" cy="6" r="2.5" fill="#FFB38A" />
                <circle cx="9" cy="6" r="2.5" fill="#FFB38A" />
                <path
                  d="M-15 -2 a15 14 0 0 1 30 0 Z"
                  fill={c.hat}
                  stroke="#0B2233"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                <rect x="-18" y="-3" width="36" height="5" rx="2.5" fill={c.hat} stroke="#0B2233" strokeWidth="2" />
                <circle cx="13" cy="14" r="8" fill="#0B2233" />
                <text
                  x="13"
                  y="18"
                  textAnchor="middle"
                  fontFamily="Nunito, sans-serif"
                  fontWeight="800"
                  fontSize="11"
                  fill="#EAF6FB"
                >
                  {c.letter}
                </text>
                {c.working && (
                  <circle
                    r="25"
                    fill="none"
                    stroke="#FFD27A"
                    strokeWidth="3"
                    strokeDasharray="20 40"
                    className="fr-spin"
                  />
                )}
              </g>
            ))}
          </g>
        </svg>
        {tip &&
          (() => {
            const a = byId.get(tip.id);
            if (!a) return null;
            const done = a.state === "done";
            const flip = tip.top < 150; // not enough room above: show below the marker
            return createPortal(
              <div
                role="tooltip"
                className="fr-tip"
                style={{
                  left: Math.min(Math.max(tip.x, 108), window.innerWidth - 108),
                  top: flip ? tip.bottom + 6 : tip.top - 6,
                  transform: flip ? "translate(-50%, 0)" : "translate(-50%, -100%)",
                }}
              >
                <b>{a.id}</b>
                <span className="fr-tip-sub">{a.typeLabel}</span>
                <span>
                  {done ? "Cleaned" : `${cap(a.level)} risk`}
                  {a.pct != null && !done ? ` · ${a.pct}%` : ""}
                </span>
                {a.daysSinceClean != null && (
                  <span>{done ? "Cleaned today" : `Last cleaned ${a.daysSinceClean} days ago`}</span>
                )}
                <span>{a.hasCamera ? "Has a camera" : "No camera"}</span>
                {a.crewLetter && <span>Crew {a.crewLetter} assigned</span>}
                <span className="fr-tip-sub">Sample data</span>
              </div>,
              document.body,
            );
          })()}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 22px",
          alignItems: "center",
          background: "#102F45",
          border: "2px solid #1E4A63",
          borderRadius: full ? 0 : "0 0 22px 22px",
          flexShrink: 0,
          padding: "12px 18px",
          fontSize: 14,
          color: "#CFE6F0",
        }}
      >
        {/* Cut-offs match HIGH_AT / MEDIUM_AT in risk_api/main.py (placeholders until real history exists). */}
        <Legend fill="#FF8A4C" mouth="M-5 16 q5 -6 10 0" ink="#2A1208" label="High (60%+)" />
        <Legend fill="#FFD27A" mouth="M-4 14 h8" ink="#0B2233" label="Medium (30 to 59%)" />
        <Legend fill="#4FC3E8" mouth="M-6 12 q6 7 12 0" ink="#0B2233" label="Low (under 30%)" />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden="true">
            <circle r="11" fill="#0B2233" stroke="#EAF6FB" strokeWidth="2" />
            <rect x="-6.5" y="-4.5" width="9" height="9" rx="2.5" fill="#4FC3E8" />
            <path d="M3 -1.5 L7 -4 V4 L3 1.5Z" fill="#4FC3E8" />
            <circle cx="-2" cy="0" r="2" fill="#0B2233" />
          </svg>
          has a camera
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          Show on map:
          {crews.map((c) => {
            const key = c.id ?? c.name;
            const shown = !hiddenCrews.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={shown}
                aria-label={`${c.name} on the map`}
                title={shown ? `Hide ${c.name}` : `Show ${c.name}`}
                onClick={() => onToggleCrew?.(key)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  minHeight: 36,
                  padding: "2px 8px",
                  background: "transparent",
                  border: 0,
                  borderRadius: 999,
                  color: shown ? "#EAF6FB" : "#8FB8CC",
                  cursor: "pointer",
                  font: "inherit",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    background: shown ? c.hat : "transparent",
                    border: `3px solid ${c.hat}`,
                    flex: "none",
                  }}
                />
                {c.name}
              </button>
            );
          })}
        </span>
        <span>
          Real map, sample GPT and depot positions (not council assets). Map data{" "}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            style={{ color: "#8FB8CC" }}
          >
            OpenStreetMap contributors
          </a>
          , tiles{" "}
          <a href="https://openfreemap.org" target="_blank" rel="noreferrer" style={{ color: "#8FB8CC" }}>
            OpenFreeMap
          </a>
        </span>
      </div>
    </div>
  );
}

function order(a: MapAsset) {
  if (a.state === "idle" && a.planN) return 4; // stops in the proposed run are drawn above every other GPT
  return a.state === "done" ? 0 : { low: 1, medium: 2, high: 3 }[a.level];
}
function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
function Legend({ fill, mouth, ink, label }: { fill: string; mouth: string; ink: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg width="20" height="20" viewBox="-20 -28 40 56" aria-hidden="true">
        <path
          d="M0 -26 C11 -12 19 -3 19 8 a19 19 0 0 1 -38 0 C-19 -3 -11 -12 0 -26Z"
          fill={fill}
          stroke="#FFF3EA"
          strokeWidth="3"
        />
        <path d={mouth} fill="none" stroke={ink} strokeWidth="3" />
      </svg>
      {label}
    </span>
  );
}
