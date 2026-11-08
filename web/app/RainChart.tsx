"use client";
import { useEffect, useRef, useState } from "react";
import type { RainBlock } from "../../planner/src/rainBlocks";

// Rain per block (solid bars, what-if rain stacked on top in a lighter blue), an accumulate line (running total) and, under
// each day, that day's Bureau of Meteorology range and chance of rain. Bars, line and day cards sit in one scrolling
// area, so they move together. A long period is wider than the panel: swipe or drag sideways (no scroll bar is shown).
const H = 110; // plot height
const TOP = 8; // room above the tallest bar for its value
const LABEL = 16; // value label above a bar
const PAD = 6; // keeps the line and its dots inside the picture
const GAP = 3;

const fmt = (v: number) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

export type DayInfo = { name: string; range: string; chance: string };

export default function RainChart({
  blocks,
  unitHours,
  days,
}: {
  blocks: RainBlock[];
  unitHours: 3 | 6 | 12;
  days: DayInfo[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState(440);
  const drag = useRef<{ x: number; left: number } | null>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox(Math.max(200, Math.floor(el.clientWidth))));
    ro.observe(el);
    setBox(Math.max(200, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  const n = Math.max(1, blocks.length);
  const minBw = unitHours === 3 ? 34 : unitHours === 6 ? 46 : 56;
  const fit = (box - GAP * (n - 1)) / n;
  const bw = Math.max(minBw, fit); // short periods fill the panel, long ones are wider and scroll
  const width = n * bw + (n - 1) * GAP;
  const overflow = width > box + 1;
  const plotH = LABEL + TOP + H + PAD;
  const maxBar = Math.max(1, ...blocks.map((b) => b.baseMm + b.extraMm));
  const total = blocks.at(-1)?.cumMm ?? 0;
  const maxCum = Math.max(1, total);
  const cx = (i: number) => i * (bw + GAP) + bw / 2;
  const cy = (cum: number) => LABEL + TOP + PAD + (H - 2 * PAD) * (1 - cum / maxCum);
  const points = blocks.map((b, i) => `${cx(i)},${cy(b.cumMm)}`).join(" ");
  const label = `Rain every ${unitHours} hours with a running total. Total ${fmt(total)} mm. Scroll sideways for more.`;

  const perDay = blocks.reduce<number[]>((acc, b) => {
    acc[b.dayIdx] = (acc[b.dayIdx] ?? 0) + 1;
    return acc;
  }, []);

  // Mouse drag to scroll, since the scroll bar is hidden (touch and trackpad scroll natively).
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !overflow) return;
    drag.current = { x: e.clientX, left: scroller.current?.scrollLeft ?? 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (drag.current && scroller.current)
      scroller.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
  };
  const onUp = () => {
    drag.current = null;
  };

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 700 }}>
        <span style={{ color: "#8FB8CC", fontWeight: 600 }}>{overflow ? "Swipe or drag sideways for more" : ""}</span>
        <span style={{ color: "#EAF6FB" }}>Running total {fmt(total)} mm</span>
      </div>
      <div
        ref={scroller}
        className="fr-scroll fr-noscrollbar"
        tabIndex={0}
        role="group"
        aria-label={label}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ cursor: overflow ? "grab" : undefined }}
      >
        <div style={{ width, position: "relative", paddingTop: 4 }}>
          <div style={{ position: "relative", height: plotH }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: GAP, height: plotH - PAD }}>
              {blocks.map((b, i) => {
                const t = b.baseMm + b.extraMm;
                const hBase = (b.baseMm / maxBar) * H;
                const hExtra = (b.extraMm / maxBar) * H;
                return (
                  <div key={i} style={{ width: bw, flex: "0 0 auto", position: "relative", height: plotH - PAD }}>
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
                          borderRadius: b.extraMm > 0.04 ? "0 0 3px 3px" : "6px 6px 3px 3px",
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
              height={plotH}
              style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none", overflow: "visible" }}
              aria-hidden="true"
            >
              <polyline points={points} fill="none" stroke="#EAF6FB" strokeWidth={2.5} strokeLinejoin="round" />
              {blocks.map((b, i) => (
                <circle key={i} cx={cx(i)} cy={cy(b.cumMm)} r={3} fill="#EAF6FB" />
              ))}
            </svg>
          </div>
          <div style={{ display: "flex", gap: GAP, marginTop: 2 }}>
            {blocks.map((b, i) => (
              <span
                key={i}
                style={{
                  width: bw,
                  flex: "0 0 auto",
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#8FB8CC",
                }}
              >
                {String(b.hour).padStart(2, "0")}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: GAP, marginTop: 6, paddingBottom: 4 }}>
            {perDay.map((count, d) => {
              const info = days[d];
              if (!info) return null;
              return (
                <div
                  key={d}
                  style={{
                    width: count * bw + (count - 1) * GAP,
                    flex: "0 0 auto",
                    boxSizing: "border-box",
                    border: "1px solid #2D6182",
                    borderRadius: 8,
                    padding: "3px 2px",
                    textAlign: "center",
                    fontSize: 11,
                    lineHeight: 1.3,
                    color: "#CFE6F0",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  <b style={{ display: "block", color: "#EAF6FB", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {info.name}
                  </b>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{info.range}</span>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{info.chance}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
