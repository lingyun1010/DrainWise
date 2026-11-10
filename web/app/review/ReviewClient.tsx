"use client";

import { useEffect, useState } from "react";
import { ConfirmDialog } from "../Dialog";

type Level = 0 | 1 | 2 | 3;
type Suggestion = { level: Level; confidence: number; rationale: string };
type Ask =
  { state: "idle" } | { state: "loading" } | { state: "done"; s: Suggestion } | { state: "error"; msg: string };
// Only metadata is kept (no image): which image, the confirmed level, what the model suggested, when.
type Label = { level: Level; suggested: Level | null; at: string };
// One card: either one of the 7 local samples (key "1".."7") or a stored crew photo (key "p-<uuid>").
type Item = { key: string; src: string; title: string; detail?: string; photoId?: string };
type StoredPhoto = {
  id: string;
  at: string;
  runId: string;
  stopId: string;
  crewId: string;
  suggested: Level | null;
  confirmed: Level | null;
  confirmedAt: string | null;
};

const STORE = "drainwise.reviewLabels";
const LEVELS: { level: Level; name: string; hint: string }[] = [
  { level: 0, name: "Clear", hint: "Open, no debris" },
  { level: 1, name: "Light debris", hint: "Some leaves, flow fine" },
  { level: 2, name: "Half blocked", hint: "About half covered" },
  { level: 3, name: "Blocked", hint: "Blocked or overflowing" },
];

function loadLabels(): Record<string, Label> {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as Record<string, Label>) : {};
  } catch {
    return {};
  }
}
function saveLabels(v: Record<string, Label>) {
  try {
    // Only the sample labels live in this browser; stored crew photos keep their label in the database.
    const samples = Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith("p-")));
    localStorage.setItem(STORE, JSON.stringify(samples));
  } catch {
    /* storage can be blocked; the page still works for this visit */
  }
}

export default function ReviewClient({ count, mock }: { count: number; mock: boolean }) {
  const [labels, setLabels] = useState<Record<string, Label>>({});
  const [asks, setAsks] = useState<Record<string, Ask>>({});
  const [picked, setPicked] = useState<Record<string, Level>>({});
  const [clearing, setClearing] = useState(false);
  const [removing, setRemoving] = useState<Item | null>(null);
  const [crew, setCrew] = useState<
    { state: "loading" } | { state: "error"; msg: string } | { state: "ok"; items: Item[] }
  >({ state: "loading" });

  useEffect(() => {
    // labels live in localStorage, only readable in the browser
    setLabels(loadLabels());
    // stored crew photos come from the database through the local server
    (async () => {
      try {
        const res = await fetch("/api/review/photos", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "request failed");
        const photos = data.photos as StoredPhoto[];
        setCrew({
          state: "ok",
          items: photos.map((p) => ({
            key: `p-${p.id}`,
            photoId: p.id,
            src: `/api/review/image?id=${p.id}`,
            title: `Crew photo · ${p.stopId}`,
            detail: `${p.crewId} · ${p.runId} · ${new Date(p.at).toLocaleString()}`,
          })),
        });
        setLabels((prev) => {
          const next = { ...prev };
          for (const p of photos) {
            if (p.confirmed !== null) {
              next[`p-${p.id}`] = { level: p.confirmed, suggested: p.suggested, at: p.confirmedAt ?? p.at };
            }
          }
          return next;
        });
      } catch (e) {
        setCrew({ state: "error", msg: e instanceof Error ? e.message : "request failed" });
      }
    })();
  }, []);

  const samples: Item[] = Array.from({ length: count }, (_, i) => ({
    key: String(i + 1),
    src: `/api/review/image?n=${i + 1}`,
    title: `Sample image ${i + 1}`,
  }));
  const crewItems = crew.state === "ok" ? crew.items : [];
  const all = [...crewItems, ...samples];
  const confirmed = all.filter((it) => labels[it.key]).length;
  const sampleConfirmed = samples.filter((it) => labels[it.key]).length;

  async function ask(it: Item) {
    setAsks((a) => ({ ...a, [it.key]: { state: "loading" } }));
    try {
      const res = await fetch("/api/review/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(it.photoId ? { id: it.photoId } : { n: Number(it.key) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setAsks((a) => ({ ...a, [it.key]: { state: "done", s: data as Suggestion } }));
      setPicked((p) => (p[it.key] === undefined ? { ...p, [it.key]: (data as Suggestion).level } : p));
    } catch (e) {
      setAsks((a) => ({ ...a, [it.key]: { state: "error", msg: e instanceof Error ? e.message : "request failed" } }));
    }
  }

  async function confirm(it: Item) {
    const level = picked[it.key];
    if (level === undefined) return;
    const a = asks[it.key];
    const suggested = a?.state === "done" ? a.s.level : null;
    if (it.photoId) {
      try {
        const res = await fetch("/api/review/photos/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: it.photoId, level, suggested }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "request failed");
      } catch (e) {
        setAsks((m) => ({
          ...m,
          [it.key]: { state: "error", msg: e instanceof Error ? e.message : "request failed" },
        }));
        return;
      }
    }
    const next = { ...labels, [it.key]: { level, suggested, at: new Date().toISOString() } };
    setLabels(next);
    saveLabels(next);
  }

  function clearSamples() {
    const next = Object.fromEntries(Object.entries(labels).filter(([k]) => k.startsWith("p-")));
    setLabels(next);
    saveLabels(next);
    setClearing(false);
  }

  async function removePhoto(it: Item) {
    setRemoving(null);
    try {
      const res = await fetch("/api/review/photos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: it.photoId }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "request failed");
      setCrew((c) => (c.state === "ok" ? { state: "ok", items: c.items.filter((x) => x.key !== it.key) } : c));
      setLabels((l) => Object.fromEntries(Object.entries(l).filter(([k]) => k !== it.key)));
    } catch (e) {
      setAsks((m) => ({ ...m, [it.key]: { state: "error", msg: e instanceof Error ? e.message : "request failed" } }));
    }
  }

  function card(it: Item) {
    const n = it.key;
    const a = asks[n] ?? { state: "idle" as const };
    const label = labels[n];
    return (
      <section key={n} className="fr-section" aria-labelledby={`rv-h-${n}`}>
        <h2 id={`rv-h-${n}`} style={{ margin: "0 0 4px", fontSize: 20 }}>
          {it.title}
        </h2>
        {it.detail && <div style={{ color: "var(--fr-mute)", fontSize: 13, marginBottom: 8 }}>{it.detail}</div>}
        {/* eslint-disable-next-line @next/next/no-img-element -- local route, small set, no optimiser needed */}
        <img
          src={it.src}
          alt={`${it.title} of a GPT site`}
          width={960}
          height={720}
          style={{ width: "100%", height: "auto", borderRadius: 14, background: "var(--fr-bg)" }}
        />

        <div style={{ marginTop: 12, minHeight: 64 }} aria-live="polite">
          {a.state === "idle" && <span style={{ color: "var(--fr-mute)" }}>No suggestion yet.</span>}
          {a.state === "loading" && <span>Asking the vision model…</span>}
          {a.state === "error" && (
            <span role="alert" style={{ color: "var(--fr-orange)" }}>
              Could not complete the request: {a.msg}
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
          onClick={() => ask(it)}
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
            onClick={() => confirm(it)}
          >
            {picked[n] === undefined ? "Confirm level" : `Confirm level ${picked[n]}`}
          </button>
          {it.photoId && (
            <button className="fr-btn fr-ghost" type="button" style={{ minHeight: 40 }} onClick={() => setRemoving(it)}>
              Delete photo
            </button>
          )}
          <span aria-live="polite" style={{ fontSize: 14, color: label ? "var(--fr-green)" : "var(--fr-mute)" }}>
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
  }

  const grid = { display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" } as const;

  return (
    <main style={{ minHeight: "100vh", background: "var(--fr-bg)", padding: "20px 16px 48px" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto" }}>
        <div className="fr-label">Prototype · sample data</div>
        <h1 style={{ margin: "4px 0 12px", fontSize: 32, fontFamily: "var(--font-fredoka)" }}>Photo review</h1>

        <section
          role="note"
          className="fr-section"
          style={{ border: "2px dashed var(--fr-yellow)", marginBottom: 20, fontSize: 15, lineHeight: 1.5 }}
        >
          {process.env.NEXT_PUBLIC_PUBLIC_BUILD === "1" && (
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>
              Public demo: anyone with this address can see and delete the crew photos below. Photos are deleted after
              24 hours. Do not upload faces, people or number plates.
            </p>
          )}
          {mock && (
            <p style={{ margin: "0 0 8px", fontWeight: 700 }}>
              Mock AI: no vision key is set, so suggestions are fake (picked from the file bytes). Add OPENAI_API_KEY to
              web/.env.local for real ones.
            </p>
          )}
          <strong>Prototype. Human review required. No accuracy claim.</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 20, listStyle: "disc", color: "var(--fr-soft)" }}>
            <li>
              The model only suggests a level. A suggestion is not a label: only the level you confirm counts. Crew
              photo labels are saved in the DrainWise sample project; sample image labels stay in this browser.
            </li>
            <li>
              Before any photo is used for training, a face and number-plate check is required. That check is not built,
              so none of these photos enter training.
            </li>
            <li>
              Each photo is sent to the vision service only when you press Ask for suggestion. Crew photos can show
              people or number plates, so look at a photo before you ask.
            </li>
          </ul>
        </section>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <strong role="status" style={{ fontSize: 16 }}>
            {confirmed} of {all.length} confirmed
          </strong>
          <button
            className="fr-btn fr-ghost"
            type="button"
            style={{ minHeight: 40 }}
            disabled={sampleConfirmed === 0}
            onClick={() => setClearing(true)}
          >
            Clear sample labels
          </button>
        </div>

        <h2 style={{ fontSize: 22, margin: "0 0 10px" }}>Crew photos (before cleaning)</h2>
        {crew.state === "loading" && <p style={{ color: "var(--fr-mute)" }}>Loading crew photos…</p>}
        {crew.state === "error" && (
          <p role="alert" style={{ color: "var(--fr-orange)" }}>
            Could not load crew photos: {crew.msg}. They need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
            web/.env.local.
          </p>
        )}
        {crew.state === "ok" && crew.items.length === 0 && (
          <p style={{ color: "var(--fr-mute)" }}>
            No crew photos stored yet. Submit a job with photos in the crew app.
          </p>
        )}
        {crewItems.length > 0 && <div style={{ ...grid, marginBottom: 28 }}>{crewItems.map(card)}</div>}

        <h2 style={{ fontSize: 22, margin: "16px 0 10px" }}>Sample images (council briefing)</h2>
        <div style={grid}>{samples.map(card)}</div>
      </div>

      {clearing && (
        <ConfirmDialog
          label="Clear sample labels"
          eyebrow="Photo review"
          title="Clear all sample labels?"
          confirmLabel="Clear labels"
          onConfirm={clearSamples}
          onCancel={() => setClearing(false)}
        >
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            This removes the {sampleConfirmed} confirmed level{sampleConfirmed === 1 ? "" : "s"} for the sample images
            saved in this browser. Labels on crew photos are not touched. The images and the model suggestions are not
            stored, so you can review the samples again.
          </p>
        </ConfirmDialog>
      )}
      {removing && (
        <ConfirmDialog
          label="Delete photo"
          eyebrow="Photo review"
          title={`Delete ${removing.title}?`}
          confirmLabel="Delete photo"
          tone="danger"
          onConfirm={() => removePhoto(removing)}
          onCancel={() => setRemoving(null)}
        >
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            This deletes the photo file and its confirmed label from the DrainWise sample project. It cannot be undone.
            The job record in the crew app stays, and the AFTER photo of the same job is not deleted.
          </p>
        </ConfirmDialog>
      )}
    </main>
  );
}
