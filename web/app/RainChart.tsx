"use client";
import type { RainBlock } from "../../planner/src/rainBlocks";

// Rain per block (solid bars, what-if rain stacked on top in a lighter blue) and an accumulate line (running total).
// Long periods get wider than the panel: the chart scrolls sideways.
const H = 110; // plot height
const TOP = 22; // room for the value labels
const END_PAD = 78; // room for the total label at the end of the line

const fmt = (v: number) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

export default function RainChart({
  blocks,
  unitHours,
  dayNames,
}: {
  blocks: RainBlock[];
  unitHours: 3 | 6;
  dayNames: string[];
}) {
  const bw = unitHours === 3 ? 34 : 46;
  const gap = 4;
  const n = blocks.length;
  const width = n * (bw + gap) + END_PAD;
  const maxBar = Math.max(1, ...blocks.map((b) => b.baseMm + b.extraMm));
  const total = blocks.at(-1)?.cumMm ?? 0;
  const maxCum = Math.max(1, total);
  const cx = (i: number) => i * (bw + gap) + bw / 2;
  const cy = (cum: number) => TOP + H - (cum / maxCum) * H;
  const points = blocks.map((b, i) => `${cx(i)},${cy(b.cumMm)}`).join(" ");
  const label = `Rain every ${unitHours} hours with a running total. Total ${fmt(total)} mm. Scroll sideways for more.`;

  return (
    <div className="fr-scroll" tabIndex={0} role="group" aria-label={label}>
      <div style={{ width, position: "relative", marginTop: 6 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap, height: TOP + H }}>
          {blocks.map((b, i) => {
            const t = b.baseMm + b.extraMm;
            const hBase = (b.baseMm / maxBar) * H;
            const hExtra = (b.extraMm / maxBar) * H;
            return (
              <div key={i} style={{ width: bw, flex: "0 0 auto", position: "relative", height: TOP + H }}>
                {t > 0.04 && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: Math.max(2, hBase + hExtra) + 2,
                      left: -4,
                      right: -4,
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#CFE6F0",
                    }}
                  >
                    {fmt(t)}
                  </span>
                )}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    display: "flex",
                    flexDirection: "column-reverse",
                  }}
                >
                  <div
                    style={{
                      height: Math.max(2, hBase),
                      background: "#4FC3E8",
                      borderRadius: b.extraMm > 0 ? "0 0 3px 3px" : "6px 6px 3px 3px",
                    }}
                  />
                  {b.extraMm > 0.04 && (
                    <div style={{ height: hExtra, background: "#8FD8F0", borderRadius: "6px 6px 0 0" }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <svg
          width={width}
          height={TOP + H}
          style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}
          aria-hidden="true"
        >
          <polyline points={points} fill="none" stroke="#EAF6FB" strokeWidth={2.5} strokeLinejoin="round" />
          {blocks.map((b, i) => (
            <circle key={i} cx={cx(i)} cy={cy(b.cumMm)} r={2.5} fill="#EAF6FB" />
          ))}
          {n > 0 && (
            <text x={cx(n - 1) + 8} y={cy(total) + 4} fill="#EAF6FB" fontSize={13} fontWeight={700}>
              Σ {fmt(total)} mm
            </text>
          )}
        </svg>
        <div style={{ display: "flex", gap, marginTop: 4 }}>
          {blocks.map((b, i) => {
            const startsDay = i === 0 || blocks[i - 1].dayIdx !== b.dayIdx;
            return (
              <span
                key={i}
                style={{
                  width: bw,
                  flex: "0 0 auto",
                  textAlign: "center",
                  fontSize: 11,
                  lineHeight: 1.25,
                  color: "#8FB8CC",
                }}
              >
                <b style={{ display: "block", fontSize: 11, color: startsDay ? "#EAF6FB" : "transparent" }}>
                  {startsDay ? dayNames[b.dayIdx] : "."}
                </b>
                {String(b.hour).padStart(2, "0")}:00
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
