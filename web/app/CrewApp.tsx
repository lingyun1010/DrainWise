"use client";

import { useEffect, useState } from "react";
import { canComplete } from "../../planner/src/canComplete";
import {
  addLog,
  crewLetter,
  fmtClock,
  loadState,
  saveState,
  simMinute,
  subscribeRun,
  type CrewRun,
  type JobRecord,
  type SavedState,
} from "@/lib/runStore";

export const CameraIcon = ({ w = 44 }: { w?: number }) => (
  <svg width={w} height={(w * 32) / 52} viewBox="0 0 52 32" role="img" aria-label="Camera" style={{ flex: "none" }}>
    <rect x="2" y="6" width="36" height="20" rx="6" fill="#4FC3E8" stroke="#EAF6FB" strokeWidth="2" />
    <circle cx="20" cy="16" r="6" fill="#0B2233" />
    <path d="M40 12 L50 7 V25 L40 20 Z" fill="#4FC3E8" stroke="#EAF6FB" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export default function CrewApp({ onSwitchRole, standalone }: { onSwitchRole: () => void; standalone?: boolean }) {
  const [state, setState] = useState<SavedState>(() => ({ crews: [], runs: {}, records: [], log: [] }));
  const [crewId, setCrewId] = useState<string | undefined>();
  // Photos belong to one stop of one crew's run (key = crew/run/stop), so switching crew never shows another crew's photo.
  const [photos, setPhotos] = useState<Record<string, { before?: string; after?: string }>>({});

  useEffect(() => {
    const read = () => setState(loadState());
    read();
    return subscribeRun(read);
  }, []);

  // Fall back to the first crew when the picked one was removed on the manager screen.
  const crew = state.crews.find((c) => c.id === crewId) ?? state.crews[0];
  const run: CrewRun | undefined = crew ? state.runs[crew.id] : undefined;
  const crewName = crew?.name ?? "Crew";
  const meta = { crewId: crew?.id };

  function update(nextRun: CrewRun, extra: Partial<SavedState> = {}) {
    const next = { ...state, ...extra, runs: { ...state.runs, [nextRun.crew]: nextRun } };
    setState(next);
    saveState(next);
  }

  const idx = run ? run.stops.findIndex((s) => !run.done.includes(s.id)) : -1;
  const stop = run && idx >= 0 ? run.stops[idx] : undefined;
  const total = run?.stops.length ?? 0;
  const photoKey = crew && run && stop ? `${crew.id}/${run.runId}/${stop.id}` : "";
  const before = photos[photoKey]?.before;
  const after = photos[photoKey]?.after;

  function pick(kind: "before" | "after") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f || !photoKey) return;
      const url = URL.createObjectURL(f); // kept in memory only, never persisted
      setPhotos((p) => ({ ...p, [photoKey]: { ...p[photoKey], [kind]: url } }));
    };
  }

  function accept() {
    if (!run || !stop) return;
    update(
      { ...run, accepted: true },
      { log: addLog(state.log, fmtClock(simMinute()), `${crewName} accepted and is on the way to ${stop.id}.`, meta) },
    );
  }

  function finish() {
    if (!run || !stop) return;
    const t = fmtClock(simMinute());
    const rec: JobRecord = {
      stopId: stop.id,
      runId: run.runId,
      crewId: crewName,
      at: new Date().toISOString(),
      clock: t,
      pct: stop.pct,
      method: stop.photosNeeded ? "photos" : "camera",
      before: stop.photosNeeded && !!before,
      after: stop.photosNeeded && !!after,
    };
    let log = state.log;
    if (stop.photosNeeded) {
      log = addLog(log, t, `${crewName} took the before photo of ${stop.id} (added to AI training candidates).`, meta);
      log = addLog(log, t, `${crewName} took the after photo of ${stop.id} (saved as evidence).`, meta);
    }
    log = addLog(log, t, `${crewName} cleaned ${stop.id}. Risk reset.`, meta);
    const last = idx + 1 >= run.stops.length;
    if (last && run.stops.length > 1)
      log = addLog(log, t, `${crewName} finished the run and is returning to the depot.`, meta);
    // Free this stop's photos from memory once the job is submitted.
    for (const url of [before, after]) if (url) URL.revokeObjectURL(url);
    setPhotos((p) => {
      const rest = { ...p };
      delete rest[photoKey];
      return rest;
    });
    update({ ...run, done: [...run.done, stop.id] }, { records: [...state.records, rec], log });
  }

  const verdict = stop
    ? canComplete({ hasCamera: !stop.photosNeeded }, { before, after })
    : { ok: false, missing: [] as string[] };
  const loadAll = run ? run.stops.reduce((n, s) => n + s.load, 0) : 0;
  const loadDone = run ? run.stops.filter((s) => run.done.includes(s.id)).reduce((n, s) => n + s.load, 0) : 0;
  const nextNames = run && idx >= 0 ? run.stops.slice(idx + 1).map((s) => s.id) : [];

  return (
    <aside
      aria-label="Crew app"
      className={standalone ? "mx-auto w-full max-w-[380px]" : ""}
      style={{
        flex: "0 0 340px",
        width: standalone ? undefined : 340,
        maxWidth: "100%",
        alignSelf: "flex-start",
        background: "#0B2233",
        border: "6px solid #1E4A63",
        borderRadius: 40,
        padding: "22px 18px 24px",
        minHeight: 640,
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 18 }}>Crew app</span>
        <button
          className="fr-btn fr-ghost"
          type="button"
          onClick={onSwitchRole}
          style={{ padding: "6px 10px", minHeight: 40, fontSize: 14 }}
        >
          Switch role
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {state.crews.map((c) => {
          const on = c.id === crew?.id;
          return (
            <button
              key={c.id}
              type="button"
              className="fr-btn"
              aria-pressed={on}
              aria-label={c.name}
              title={c.name}
              onClick={() => setCrewId(c.id)}
              style={{
                flex: 1,
                padding: 8,
                minHeight: 44,
                fontSize: 15,
                background: on ? "#4FC3E8" : "#1E4A63",
                color: on ? "#0B2233" : "#EAF6FB",
              }}
            >
              {crewLetter(c.name)}
            </button>
          );
        })}
      </div>

      {!stop ? (
        <div style={{ textAlign: "center", padding: "40px 8px", color: "#B9D6E3" }}>
          <svg width="56" height="56" viewBox="0 0 36 36" aria-hidden="true">
            <path d="M18 3 C18 3 6 15 6 22 a12 12 0 0 0 24 0 C30 15 18 3 18 3Z" fill="#4FC3E8" />
          </svg>
          <div style={{ fontWeight: 700, fontSize: 20, color: "#EAF6FB", marginTop: 10 }}>All clear</div>
          <div style={{ fontSize: 15, marginTop: 6 }}>
            {run && total > 0 ? "Run finished. Drive back to the depot." : "Waiting for the next task."}
          </div>
        </div>
      ) : (
        <div
          className="fr-pop"
          style={{ background: "#102F45", border: "3px solid #FF8A4C", borderRadius: 20, padding: 18 }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: "#FFB38A" }}>
            {run!.accepted ? "YOU HAVE ARRIVED" : "NEW TASK"}
          </div>
          <div style={{ fontWeight: 700, fontSize: 20, margin: "6px 0" }}>
            {stop.id}
            {stop.typeLabel ? ` · ${stop.typeLabel}` : ""}
          </div>
          <div style={{ fontSize: 15, color: "#CFE6F0", lineHeight: 1.4, marginBottom: 10 }}>
            {stop.pct != null
              ? `Estimated risk ${stop.pct}% (${stop.tier}). ${stop.why ?? ""}`
              : "Estimated risk from sample data."}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#8FB8CC", marginBottom: 12 }}>
            Job: Clear leaves and debris
          </div>

          {total > 1 && (
            <div style={{ background: "#0B2233", borderRadius: 14, padding: "10px 12px", marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: "#FFD27A" }}>
                RUN · STOP {idx + 1} OF {total}
              </div>
              <div style={{ height: 8, background: "#1E4A63", borderRadius: 999, margin: "8px 0" }}>
                <div
                  style={{
                    height: "100%",
                    borderRadius: 999,
                    background: "#FFD27A",
                    width: `${Math.min(100, Math.round((loadAll / run!.capacity) * 100))}%`,
                  }}
                />
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.4, color: "#CFE6F0" }}>
                Planned load {loadAll.toFixed(1)} of {run!.capacity.toFixed(1)} m³ · collected so far{" "}
                {loadDone.toFixed(1)} m³ (estimated)
                <br />
                {nextNames.length ? `Next: ${nextNames.join(", ")}` : "Last stop, then back to the depot"}
              </div>
            </div>
          )}

          {!run!.accepted ? (
            <button className="fr-btn fr-pri" type="button" onClick={accept} style={{ width: "100%" }}>
              Accept task
            </button>
          ) : !stop.photosNeeded ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  background: "#0B2233",
                  borderRadius: 14,
                  padding: 10,
                }}
              >
                <CameraIcon />
                <div style={{ fontSize: 13, lineHeight: 1.35, color: "#CFE6F0" }}>
                  <b style={{ color: "#7ED9A3" }}>Camera site</b>
                  <br />
                  The camera records before and after, so no photos are needed.
                </div>
              </div>
              <button className="fr-btn fr-pri" type="button" onClick={finish} style={{ width: "100%" }}>
                Mark as cleaned
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: "#8FB8CC" }}>
                PROOF OF WORK · 2 PHOTOS REQUIRED
              </div>
              {!before ? (
                <>
                  <div style={{ fontSize: 14, color: "#CFE6F0", lineHeight: 1.4 }}>
                    <b>Step 1.</b> Photograph the drain as you found it. Drain only, no people or number plates.
                  </div>
                  <label className="fr-btn fr-pri" style={{ width: "100%" }}>
                    Take BEFORE photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={pick("before")}
                    />
                  </label>
                </>
              ) : (
                <Thumb
                  src={before}
                  alt="Before cleaning"
                  color="#FFD27A"
                  title="Before saved"
                  sub="Used to improve the AI"
                />
              )}
              {before && !after && (
                <>
                  <div style={{ fontSize: 14, color: "#CFE6F0", lineHeight: 1.4 }}>
                    <b>Step 2.</b> Clear the leaves and debris, then photograph the clean drain.
                  </div>
                  <label className="fr-btn fr-pri" style={{ width: "100%" }}>
                    Take AFTER photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="sr-only"
                      onChange={pick("after")}
                    />
                  </label>
                </>
              )}
              {after && (
                <>
                  <Thumb src={after} alt="After cleaning" color="#7ED9A3" title="After saved" sub="Kept as evidence" />
                  <button
                    className="fr-btn fr-pri"
                    type="button"
                    disabled={!verdict.ok}
                    onClick={finish}
                    style={{ width: "100%" }}
                  >
                    Submit and mark cleaned
                  </button>
                </>
              )}
              <div style={{ fontSize: 12, color: "#8FB8CC", lineHeight: 1.4 }}>
                Photos stay on this device in memory in this demo. The real app would stamp time and location on each
                photo.
              </div>
            </div>
          )}
        </div>
      )}
      <p style={{ marginTop: 16, fontSize: 12, color: "#8FB8CC" }}>Sample data. Signed in as {crewName}.</p>
    </aside>
  );
}

function Thumb({
  src,
  alt,
  color,
  title,
  sub,
}: {
  src: string;
  alt: string;
  color: string;
  title: string;
  sub: string;
}) {
  return (
    <div
      style={{ display: "flex", gap: 10, alignItems: "center", background: "#0B2233", borderRadius: 14, padding: 8 }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} style={{ width: 84, height: 56, borderRadius: 10, objectFit: "cover", flex: "none" }} />
      <div style={{ fontSize: 13, lineHeight: 1.35, color: "#CFE6F0" }}>
        <b style={{ color }}>{title}</b>
        <br />
        {sub}
      </div>
    </div>
  );
}
