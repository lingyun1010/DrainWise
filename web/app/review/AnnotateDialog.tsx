"use client";

import { useRef, useState } from "react";
import {
  DAMAGE,
  MAX_CAPTION,
  MAX_NOTE,
  MAX_SHAPES,
  sourceOf,
  type Damage,
  type Shape,
  type Source,
} from "../../../planner/src/annotations";
import Dialog, { ConfirmDialog } from "../Dialog";

export type Reading = { band: number | null; damage: Damage | null; note: string; shapes: Shape[] };
export type Prefill = { band: number | null; bandSource: Source; damage: Damage | null; damageSource: Source };

const DAMAGE_NAME: Record<Damage, string> = {
  none: "No damage",
  net_full: "Net full",
  net_broken: "Net broken",
  net_fallen: "Net fallen",
};
const SRC_NAME: Record<Source, string> = {
  mock: "Mock reading",
  "reference-diff": "Reference comparison",
  admin: "Marked by admin",
};
const BANDS = Array.from({ length: 11 }, (_, i) => i * 10);
type Tool = "select" | "circle" | "arrow";
const clamp = (v: number) => Math.min(1, Math.max(0, v));

// Admin marks the net by hand: circles, arrows, captions, band and damage. No model is called.
export default function AnnotateDialog({
  title,
  src,
  start,
  prefill,
  onSave,
  onClose,
}: {
  title: string;
  src: string;
  start: Reading;
  prefill: Prefill;
  onSave: (r: Reading & { bandSource: Source | null; damageSource: Source | null }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [shapes, setShapes] = useState<Shape[]>(start.shapes);
  const [band, setBand] = useState<number | null>(start.band ?? prefill.band);
  const [damage, setDamage] = useState<Damage | null>(start.damage ?? prefill.damage);
  const [note, setNote] = useState(start.note);
  const [tool, setTool] = useState<Tool>("select");
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [ar, setAr] = useState(0.75); // height / width of the photo
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clearAsk, setClearAsk] = useState(false);
  const drag = useRef<{ mode: "new" | "move"; id: string; px: number; py: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  // pointer position as a fraction of the photo (0..1 on both axes)
  const at = (e: React.PointerEvent) => {
    const b = svg.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - b.left) / b.width), y: clamp((e.clientY - b.top) / b.height) };
  };
  const upd = (id: string, f: (s: Shape) => Shape) => setShapes((l) => l.map((s) => (s.id === id ? f(s) : s)));

  function down(e: React.PointerEvent) {
    if (tool === "select" || shapes.length >= MAX_SHAPES) return;
    const p = at(e);
    const id = `s${crypto.randomUUID().slice(0, 8)}`;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { mode: "new", id, px: p.x, py: p.y };
    setShapes((l) => [
      ...l,
      tool === "circle"
        ? { id, kind: "circle", x: p.x, y: p.y, r: 0.01, caption: "" }
        : { id, kind: "arrow", x: p.x, y: p.y, x2: p.x, y2: p.y, caption: "" },
    ]);
    setSel(id);
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const p = at(e);
    if (d.mode === "new") {
      upd(d.id, (s) =>
        s.kind === "circle"
          ? { ...s, r: Math.min(0.5, Math.max(0.01, Math.hypot(p.x - s.x, (p.y - s.y) * ar))) }
          : { ...s, x2: p.x, y2: p.y },
      );
    } else {
      const dx = p.x - d.px;
      const dy = p.y - d.py;
      d.px = p.x;
      d.py = p.y;
      upd(d.id, (s) =>
        s.kind === "circle"
          ? { ...s, x: clamp(s.x + dx), y: clamp(s.y + dy) }
          : { ...s, x: clamp(s.x + dx), y: clamp(s.y + dy), x2: clamp(s.x2 + dx), y2: clamp(s.y2 + dy) },
      );
    }
  }
  function up() {
    const d = drag.current;
    drag.current = null;
    if (d?.mode === "new") {
      // a click without a drag makes no mark
      setShapes((l) =>
        l.filter((s) => !(s.id === d.id && (s.kind === "circle" ? s.r <= 0.011 : s.x === s.x2 && s.y === s.y2))),
      );
      setTool("select");
    }
  }
  function grab(e: React.PointerEvent, s: Shape) {
    if (tool !== "select") return;
    e.stopPropagation();
    (svg.current as Element).setPointerCapture(e.pointerId);
    const p = at(e);
    drag.current = { mode: "move", id: s.id, px: p.x, py: p.y };
    setSel(s.id);
  }

  async function save() {
    setBusy(true);
    setErr(null);
    const msg = await onSave({
      band,
      damage,
      note,
      shapes,
      bandSource: band === null ? null : sourceOf({ value: prefill.band, source: prefill.bandSource }, band),
      damageSource: damage === null ? null : sourceOf({ value: prefill.damage, source: prefill.damageSource }, damage),
    });
    setBusy(false);
    if (msg) setErr(msg);
  }

  const picked = shapes.find((s) => s.id === sel) ?? null;
  const bandSrc = band === null ? null : sourceOf({ value: prefill.band, source: prefill.bandSource }, band);
  const dmgSrc = damage === null ? null : sourceOf({ value: prefill.damage, source: prefill.damageSource }, damage);
  const stroke = "#FFD27A";

  return (
    <>
      <Dialog
        label={`Mark ${title}`}
        eyebrow="Photo review"
        title={`Mark the net: ${title}`}
        maxWidth={760}
        onClose={onClose}
        actions={
          <>
            <button className="fr-btn fr-pri" type="button" disabled={busy} onClick={save}>
              {busy ? "Saving" : "Save review"}
            </button>
            <button className="fr-btn fr-ghost" type="button" onClick={onClose}>
              Cancel
            </button>
          </>
        }
      >
        <div
          style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}
          role="toolbar"
          aria-label="Marking tools"
        >
          {(["select", "circle", "arrow"] as Tool[]).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tool === t}
              className={`fr-btn ${tool === t ? "fr-pri" : "fr-sec"}`}
              style={{ minHeight: 40 }}
              disabled={t !== "select" && shapes.length >= MAX_SHAPES}
              onClick={() => setTool(t)}
            >
              {t === "select" ? "Move" : t === "circle" ? "Draw circle" : "Draw arrow"}
            </button>
          ))}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            Zoom {zoom}x
            <input
              type="range"
              min={1}
              max={4}
              step={0.5}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
        </div>

        <div style={{ maxHeight: "50vh", overflow: "auto", borderRadius: 12, background: "var(--fr-bg)" }}>
          <div style={{ position: "relative", width: `${zoom * 100}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- stored photo from a local route */}
            <img
              src={src}
              alt={title}
              style={{ display: "block", width: "100%", height: "auto" }}
              onLoad={(e) => setAr(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth || 0.75)}
            />
            <svg
              ref={svg}
              viewBox={`0 0 1 ${ar}`}
              preserveAspectRatio="none"
              role="application"
              aria-label="Drawing layer. Choose a tool, then drag on the photo."
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                touchAction: tool === "select" ? "auto" : "none",
                cursor: tool === "select" ? "default" : "crosshair",
              }}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            >
              <defs>
                <marker
                  id="ah"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0 0L10 5L0 10z" fill={stroke} />
                </marker>
              </defs>
              {shapes.map((s, i) => {
                const on = s.id === sel;
                const w = on ? 0.008 : 0.005;
                return s.kind === "circle" ? (
                  <g
                    key={s.id}
                    onPointerDown={(e) => grab(e, s)}
                    style={{ cursor: tool === "select" ? "move" : undefined }}
                  >
                    <ellipse
                      cx={s.x}
                      cy={s.y * ar}
                      rx={s.r}
                      ry={s.r}
                      fill="rgba(255,210,122,0.12)"
                      stroke={stroke}
                      strokeWidth={w}
                      strokeDasharray={on ? "0.02 0.01" : undefined}
                    />
                    <text
                      x={s.x}
                      y={s.y * ar}
                      fontSize={0.04}
                      fill={stroke}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      style={{ pointerEvents: "none" }}
                    >
                      {i + 1}
                    </text>
                  </g>
                ) : (
                  <g
                    key={s.id}
                    onPointerDown={(e) => grab(e, s)}
                    style={{ cursor: tool === "select" ? "move" : undefined }}
                  >
                    <line x1={s.x} y1={s.y * ar} x2={s.x2} y2={s.y2 * ar} stroke="transparent" strokeWidth={0.04} />
                    <line
                      x1={s.x}
                      y1={s.y * ar}
                      x2={s.x2}
                      y2={s.y2 * ar}
                      stroke={stroke}
                      strokeWidth={w}
                      markerEnd="url(#ah)"
                    />
                    <text
                      x={s.x}
                      y={s.y * ar - 0.02}
                      fontSize={0.04}
                      fill={stroke}
                      textAnchor="middle"
                      style={{ pointerEvents: "none" }}
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div style={{ margin: "10px 0", minHeight: 44 }} aria-live="polite">
          {picked ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ flex: "1 1 200px" }}>
                <span className="fr-label">Caption for mark {shapes.indexOf(picked) + 1}</span>
                <input
                  className="fr-field"
                  type="text"
                  maxLength={MAX_CAPTION}
                  value={picked.caption}
                  onChange={(e) => upd(picked.id, (s) => ({ ...s, caption: e.target.value }))}
                  style={{ width: "100%", minHeight: 40 }}
                />
              </label>
              <button
                className="fr-btn fr-ghost"
                type="button"
                onClick={() => {
                  setShapes((l) => l.filter((s) => s.id !== picked.id));
                  setSel(null);
                }}
              >
                Delete mark
              </button>
            </div>
          ) : (
            <span style={{ color: "var(--fr-mute)", fontSize: 14 }}>
              {shapes.length === 0
                ? "No marks yet. Choose Draw circle or Draw arrow, then drag on the photo."
                : "Choose Move, then tap a mark to edit its caption or delete it."}
            </span>
          )}
          {shapes.length > 0 && (
            <button
              className="fr-btn fr-ghost"
              type="button"
              style={{ marginTop: 6 }}
              onClick={() => setClearAsk(true)}
            >
              Delete all {shapes.length} marks
            </button>
          )}
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <label>
            <span className="fr-label">Fullness band</span>
            <select
              className="fr-field"
              value={band ?? ""}
              onChange={(e) => setBand(e.target.value === "" ? null : Number(e.target.value))}
              style={{ width: "100%", minHeight: 40 }}
            >
              <option value="">Not set</option>
              {BANDS.map((b) => (
                <option key={b} value={b}>
                  {b === 0 ? "0% (clear)" : `${b}%`}
                </option>
              ))}
            </select>
            <small style={{ color: "var(--fr-mute)" }}>{bandSrc ? SRC_NAME[bandSrc] : "No value"}</small>
          </label>
          <label>
            <span className="fr-label">Damage</span>
            <select
              className="fr-field"
              value={damage ?? ""}
              onChange={(e) => setDamage(e.target.value === "" ? null : (e.target.value as Damage))}
              style={{ width: "100%", minHeight: 40 }}
            >
              <option value="">Not set</option>
              {DAMAGE.map((d) => (
                <option key={d} value={d}>
                  {DAMAGE_NAME[d]}
                </option>
              ))}
            </select>
            <small style={{ color: "var(--fr-mute)" }}>{dmgSrc ? SRC_NAME[dmgSrc] : "No value"}</small>
          </label>
        </div>
        <label style={{ display: "block", marginTop: 10 }}>
          <span className="fr-label">Note</span>
          <textarea
            className="fr-field"
            value={note}
            maxLength={MAX_NOTE}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: "100%" }}
          />
        </label>
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--fr-mute)", lineHeight: 1.5 }}>
          Readings are mock or a reference comparison until you change them. Nothing is trained on these yet. No
          accuracy claim.
        </p>
        {err && (
          <p role="alert" style={{ color: "var(--fr-orange)", margin: "8px 0 0" }}>
            {err}
          </p>
        )}
      </Dialog>
      {clearAsk && (
        <ConfirmDialog
          label="Delete all marks"
          eyebrow="Photo review"
          title="Delete all marks on this photo?"
          confirmLabel="Delete marks"
          tone="danger"
          onConfirm={() => {
            setShapes([]);
            setSel(null);
            setClearAsk(false);
          }}
          onCancel={() => setClearAsk(false)}
        >
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            This removes {shapes.length} mark{shapes.length === 1 ? "" : "s"} you drew in this window. Nothing is saved
            until you press Save review, and the photo itself stays. You can draw them again.
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
