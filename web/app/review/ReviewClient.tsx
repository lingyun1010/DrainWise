"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "../Dialog";

type Level = 0 | 1 | 2 | 3;
type Suggestion = { level: Level; confidence: number; rationale: string };
type Ask =
  { state: "idle" } | { state: "loading" } | { state: "done"; s: Suggestion } | { state: "error"; msg: string };
// Only metadata is kept (no image): which sample, the confirmed level, what the model suggested, when.
type Label = { level: Level; suggested: Level | null; at: string };

const STORE = "drainwise.reviewLabels";
const LEVELS: { level: Level; name: string; hint: string }[] = [
  { level: 0, name: "Clear", hint: "Open, no debris" },
  { level: 1, name: "Light debris", hint: "Some leaves, flow fine" },
  { level: 2, name: "Half blocked", hint: "About half covered" },
  { level: 3, name: "Blocked", hint: "Blocked or overflowing" },
];

function loadLabels(): Record<number, Label> {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Record<number, Label>) : {};
  } catch {
    return {};
  }
}
function saveLabels(v: Record<number, Label>) {
  try {
    localStorage.setItem(STORE, JSON.stringify(v));
  } catch {
    /* storage can be blocked; the page still works for this visit */
  }
}

export default function ReviewClient({ count }: { count: number }) {
  const [labels, setLabels] = useState<Record<number, Label>>({});
  const [asks, setAsks] = useState<Record<number, Ask>>({});
  const [picked, setPicked] = useState<Record<number, Level>>({});
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    // labels live in localStorage, only readable in the browser
    setLabels(loadLabels());
  }, []);

  const numbers = Array.from({ length: count }, (_, i) => i + 1);
  const confirmed = numbers.filter((n) => labels[n]).length;

  async function ask(n: number) {
    setAsks((a) => ({ ...a, [n]: { state: "loading" } }));
    try {
      const res = await fetch("/api/review/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setAsks((a) => ({ ...a, [n]: { state: "done", s: data as Suggestion } }));
      setPicked((p) => (p[n] === undefined ? { ...p, [n]: (data as Suggestion).level } : p));
    } catch (e) {
      setAsks((a) => ({ ...a, [n]: { state: "error", msg: e instanceof Error ? e.message : "request failed" } }));
    }
  }

  function confirm(n: number) {
    const level = picked[n];
    if (level === undefined) return;
    const a = asks[n];
    const next = {
      ...labels,
      [n]: { level, suggested: a?.state === "done" ? a.s.level : null, at: new Date().toISOString() },
    };
    setLabels(next);
    saveLabels(next);
  }

  function clearAll() {
    setLabels({});
    saveLabels({});
    setClearing(false);
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--fr-bg)", padding: "20px 16px 48px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div className="fr-label">Local prototype · sample data</div>
        <h1 style={{ margin: "4px 0 12px", fontSize: 32, fontFamily: "var(--font-fredoka)" }}>Photo review</h1>

        <section
          role="note"
          className="fr-section"
          style={{ border: "2px dashed var(--fr-yellow)", marginBottom: 20, fontSize: 15, lineHeight: 1.5 }}
        >
          <strong>Prototype. Human review required. No accuracy claim.</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, listStyle: "disc", color: "var(--fr-soft)" }}>
            <li>
              The model only suggests a level. A suggestion is not a label: only the level you confirm counts, and only
              its metadata is kept (no image).
            </li>
            <li>
              Before any photo is used for training, a face and number-plate check is required. That check is not built,
              so none of these photos enter training.
            </li>
            <li>
              The 7 images are camera photos from the council briefing, shown from a local copy that is not committed.
              Each one is sent to the vision service when you press Ask for suggestion.
            </li>
          </ul>
        </section>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <strong role="status" style={{ fontSize: 16 }}>
            {confirmed} of {count} confirmed
          </strong>
          <button
            className="fr-btn fr-ghost"
            type="button"
            style={{ minHeight: 40 }}
            disabled={confirmed === 0}
            onClick={() => setClearing(true)}
          >
            Clear confirmed labels
          </button>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          {numbers.map((n) => {
            const a = asks[n] ?? { state: "idle" as const };
            const label = labels[n];
            return (
              <section key={n} className="fr-section" aria-labelledby={`rv-h-${n}`}>
                <h2 id={`rv-h-${n}`} style={{ margin: "0 0 10px", fontSize: 20 }}>
                  Sample image {n}
                </h2>
                {/* eslint-disable-next-line @next/next/no-img-element -- local route, fixed small set, no optimiser needed */}
                <img
                  src={`/api/review/image?n=${n}`}
                  alt={`Sample camera photo ${n} of a drain site`}
                  width={960}
                  height={720}
                  style={{ width: "100%", height: "auto", borderRadius: 14, background: "var(--fr-bg)" }}
                />

                <div style={{ marginTop: 12, minHeight: 64 }} aria-live="polite">
                  {a.state === "idle" && <span style={{ color: "var(--fr-mute)" }}>No suggestion yet.</span>}
                  {a.state === "loading" && <span>Asking the vision model…</span>}
                  {a.state === "error" && (
                    <span role="alert" style={{ color: "var(--fr-orange)" }}>
                      Could not get a suggestion: {a.msg}
                    </span>
                  )}
                  {a.state === "done" && (
                    <>
                      <strong>
                        Suggestion: level {a.s.level} · {LEVELS[a.s.level].name}
                      </strong>
                      <span style={{ color: "var(--fr-mute)" }}> · confidence {Math.round(a.s.confidence * 100)}%</span>
                      <div style={{ color: "var(--fr-soft)", marginTop: 4, fontSize: 14 }}>{a.s.rationale}</div>
                    </>
                  )}
                </div>

                <button
                  className="fr-btn fr-sec"
                  type="button"
                  style={{ minHeight: 40, marginTop: 8 }}
                  disabled={a.state === "loading"}
                  onClick={() => ask(n)}
                >
                  {a.state === "done" || a.state === "error" ? "Ask again" : "Ask for suggestion"}
                </button>

                <fieldset style={{ border: 0, padding: 0, margin: "14px 0 0" }}>
                  <legend className="fr-label" style={{ marginBottom: 6 }}>
                    Your level
                  </legend>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {LEVELS.map((l) => {
                      const on = picked[n] === l.level;
                      return (
                        <button
                          key={l.level}
                          type="button"
                          aria-pressed={on}
                          className={`fr-btn ${on ? "fr-pri" : "fr-sec"}`}
                          style={{ minHeight: 40, padding: "8px 10px", flexDirection: "column", fontSize: 14 }}
                          onClick={() => setPicked((p) => ({ ...p, [n]: l.level }))}
                        >
                          <span>
                            {l.level} · {l.name}
                          </span>
                          <span style={{ fontWeight: 400, fontSize: 12 }}>{l.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                  <button
                    className="fr-btn fr-pri"
                    type="button"
                    style={{ minHeight: 40 }}
                    disabled={picked[n] === undefined}
                    onClick={() => confirm(n)}
                  >
                    {picked[n] === undefined ? "Confirm level" : `Confirm level ${picked[n]}`}
                  </button>
                  <span
                    aria-live="polite"
                    style={{ fontSize: 14, color: label ? "var(--fr-green)" : "var(--fr-mute)" }}
                  >
                    {label
                      ? `Confirmed: level ${label.level} · ${LEVELS[label.level].name}${
                          label.suggested === null
                            ? " (no suggestion used)"
                            : label.suggested === label.level
                              ? " (matches the suggestion)"
                              : ` (suggestion was ${label.suggested})`
                        }`
                      : "Not confirmed"}
                  </span>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {clearing && (
        <ConfirmDialog
          label="Clear confirmed labels"
          eyebrow="Photo review"
          title="Clear all confirmed labels?"
          confirmLabel="Clear labels"
          onConfirm={clearAll}
          onCancel={() => setClearing(false)}
        >
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            This removes the {confirmed} confirmed level{confirmed === 1 ? "" : "s"} saved in this browser. The sample
            images and the model suggestions are not stored, so nothing else changes. You can review the images again.
          </p>
        </ConfirmDialog>
      )}
    </main>
  );
}
