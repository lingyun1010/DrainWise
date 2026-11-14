"use client";

import Image from "next/image";

import ReasonDialog, { type ReasonKind } from "./ReasonDialog";
import RoomChip from "./RoomChip";
import { useEffect, useState } from "react";
import { canComplete } from "../../planner/src/canComplete";
import {
  declineRun,
  endRunEarly,
  isOpen,
  openStops,
  reasonLabel,
  skipStop,
  type Reason,
} from "../../planner/src/runActions";
import { mockSuggestion } from "../../planner/src/mockSuggestion";
import type { Suggestion } from "../../planner/src/parseSuggestion";
import {
  addLog,
  crewLetter,
  sydneyClock,
  loadState,
  saveState,
  subscribeRun,
  type CrewRun,
  type JobRecord,
  type SavedState,
} from "@/lib/runStore";
import { IS_PUBLIC_DEMO, PHOTO_UPLOAD_ON, uploadJobPhotos } from "@/lib/uploadPhoto";

const MOCK_NAMES = ["Clear", "Light debris", "Half blocked", "Blocked"];

export const CameraIcon = ({ w = 44 }: { w?: number }) => (
  <svg width={w} height={(w * 32) / 52} viewBox="0 0 52 32" role="img" aria-label="Camera" style={{ flex: "none" }}>
    <rect x="2" y="6" width="36" height="20" rx="6" fill="#4FC3E8" stroke="#EAF6FB" strokeWidth="2" />
    <circle cx="20" cy="16" r="6" fill="#0B2233" />
    <path d="M40 12 L50 7 V25 L40 20 Z" fill="#4FC3E8" stroke="#EAF6FB" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export default function CrewApp({
  onSwitchRole,
  standalone,
  lockedCrewId,
  onSignOut,
}: {
  onSwitchRole: () => void;
  standalone?: boolean;
  lockedCrewId?: string; // signed in as this crew: no other crew is shown
  onSignOut?: () => void;
}) {
  const [state, setState] = useState<SavedState>(() => ({ crews: [], runs: {}, records: [], log: [] }));
  const [crewId, setCrewId] = useState<string | undefined>();
  // Photos belong to one stop of one crew's run (key = crew/run/stop), so switching crew never shows another crew's photo.
  const [photos, setPhotos] = useState<
    Record<string, { before?: string; after?: string; beforeFile?: File; afterFile?: File }>
  >({});

  // Mock "AI check" results, per stop like the photos (see planner/src/mockSuggestion.ts).
  const [asking, setAsking] = useState<ReasonKind | null>(null);
  const [notice, setNotice] = useState("");
  const [mocks, setMocks] = useState<Record<string, Suggestion | undefined>>({});

  useEffect(() => {
    const read = () => setState(loadState());
    read();
    return subscribeRun(read);
  }, []);

  // Fall back to the first crew when the picked one was removed on the manager screen.
  const crew = lockedCrewId
    ? state.crews.find((c) => c.id === lockedCrewId)
    : (state.crews.find((c) => c.id === crewId) ?? state.crews[0]);
  const run: CrewRun | undefined = crew ? state.runs[crew.id] : undefined;
  const crewName = crew?.name ?? "Crew";
  const meta = { crewId: crew?.id };

  function update(nextRun: CrewRun, extra: Partial<SavedState> = {}) {
    const next = { ...state, ...extra, runs: { ...state.runs, [nextRun.crew]: nextRun } };
    setState(next);
    saveState(next);
  }

  const idx = run ? run.stops.findIndex((s) => isOpen(run, s.id)) : -1;
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
      setPhotos((p) => ({ ...p, [photoKey]: { ...p[photoKey], [kind]: url, [`${kind}File`]: f } }));
    };
  }

  function accept() {
    if (!run || !stop) return;
    update(
      { ...run, accepted: true },
      { log: addLog(state.log, sydneyClock(), `${crewName} accepted and is on the way to ${stop.id}.`, meta) },
    );
  }

  // Decline, skip or end early. Re-reads the shared state first so a withdrawn run is never overwritten.
  function leave(kind: ReasonKind, reason: Reason, note?: string) {
    setAsking(null);
    if (!crew || !stop) return;
    const now = loadState();
    const live = now.runs[crew.id];
    if (!live || live.runId !== run?.runId) {
      setState(now);
      setNotice("Run was withdrawn by the manager.");
      return;
    }
    const at = new Date().toISOString();
    const why = `${reasonLabel(reason)}${note ? ` (${note})` : ""}`;
    const t = sydneyClock();
    let next = now;
    let text: string;
    const left = openStops(live)
      .map((s) => s.id)
      .join(", "); // GPT numbers still not cleaned
    const done = live.done.length ? ` Already cleaned: ${live.done.join(", ")}.` : "";
    if (kind === "decline") {
      next = declineRun(now, crew.id, reason, at, note);
      text = `${crewName} declined the run (${left}): ${why}. Back in the queue.`;
    } else if (kind === "skip") {
      next = skipStop(now, crew.id, stop.id, reason, at, note);
      text =
        next.runs[crew.id]?.ended || !next.runs[crew.id]
          ? `${crewName} ended the run early: ${why}. Not cleaned, back in the queue: ${left}.${done}`
          : `${crewName} skipped ${stop.id}: ${why}. Back in the queue.`;
    } else {
      next = endRunEarly(now, crew.id, reason, at, note);
      text = `${crewName} ended the run early: ${why}. Not cleaned, back in the queue: ${left}.${done}`;
    }
    if (next === now) return;
    next = { ...next, log: addLog(next.log, t, text, { ...meta, runId: live.runId }) };
    setState(next);
    saveState(next);
    setNotice(text);
  }

  function finish() {
    if (!run || !stop) return;
    const t = sydneyClock();
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
    if (stop.photosNeeded && !PHOTO_UPLOAD_ON) {
      log = addLog(log, t, `${crewName} took the before photo of ${stop.id} (added to AI training candidates).`, meta);
      log = addLog(log, t, `${crewName} took the after photo of ${stop.id} (saved as evidence).`, meta);
    }
    if (stop.photosNeeded && PHOTO_UPLOAD_ON) {
      // Saving happens after the job is recorded, so a slow network never blocks the crew.
      const files = { before: photos[photoKey]?.beforeFile, after: photos[photoKey]?.afterFile };
      const who = { crewId: crew!.id, runId: run.runId };
      const stopId = stop.id;
      void uploadJobPhotos(files, { runId: run.runId, stopId, assetId: stopId, crewId: crew!.id }).then((saved) => {
        const now = loadState();
        const text = saved
          ? `${crewName} photos of ${stopId} saved for review.`
          : `${crewName} photos of ${stopId} could not be saved. They stay on this device only.`;
        saveState({ ...now, log: addLog(now.log, sydneyClock(), text, who) });
      });
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

  const mock = mocks[photoKey];
  const verdict = stop
    ? canComplete({ hasCamera: !stop.photosNeeded }, { before, after })
    : { ok: false, missing: [] as string[] };
  const loadAll = run ? run.stops.reduce((n, s) => n + s.load, 0) : 0;
  const loadDone = run ? run.stops.filter((s) => run.done.includes(s.id)).reduce((n, s) => n + s.load, 0) : 0;
  const nextNames =
    run && idx >= 0
      ? run.stops
          .slice(idx + 1)
          .filter((s) => isOpen(run, s.id))
          .map((s) => s.id)
      : [];

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
      {standalone && <h1 className="fr-sr">DrainWise crew app</h1>}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <button
          type="button"
          aria-label="DrainWise crew app, back to home"
          title="Back to home"
          onClick={onSwitchRole}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: "none",
            background: "none",
            border: 0,
            padding: 0,
            cursor: "pointer",
          }}
        >
          <Image src="/brand-mascot.png" alt="" width={34} height={30} unoptimized />
          <Image src="/brand-wordmark.png" alt="" width={80} height={18} unoptimized />
        </button>
        <RoomChip compact />
      </div>
      {lockedCrewId ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div
            style={{
              flex: 1,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              borderRadius: 12,
              background: "#1E4A63",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            Signed in as {crew?.name ?? "a crew that no longer exists"}
          </div>
          <button type="button" className="fr-btn fr-ghost" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      ) : (
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
      )}

      {!stop ? (
        <div className="fr-crewempty" style={{ textAlign: "center", padding: "40px 8px", color: "#B9D6E3" }}>
          <svg width="56" height="56" viewBox="0 0 36 36" aria-hidden="true" style={{ margin: "0 auto" }}>
            <path d="M18 3 C18 3 6 15 6 22 a12 12 0 0 0 24 0 C30 15 18 3 18 3Z" fill="#4FC3E8" />
          </svg>
          <div style={{ fontWeight: 700, fontSize: 20, color: "#EAF6FB", marginTop: 10 }}>All clear</div>
          <div style={{ fontSize: 15, marginTop: 6 }}>
            {run?.ended
              ? `Run ended early: ${reasonLabel(run.ended.reason)}. Drive back to the depot.`
              : run && total > 0
                ? "Run finished. Drive back to the depot."
                : "Waiting for the next task."}
          </div>
          {notice && (
            <div role="status" style={{ fontSize: 13, marginTop: 12, color: "#8FB8CC", lineHeight: 1.4 }}>
              {notice}
            </div>
          )}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 13, lineHeight: 1.4, color: "#8FB8CC" }}>
                A suggested run from the planner. The contractor decides the day and the people.
              </div>
              <button className="fr-btn fr-pri" type="button" onClick={accept} style={{ width: "100%" }}>
                Accept task
              </button>
              <button className="fr-btn fr-ghost" type="button" onClick={() => setAsking("decline")}>
                Decline run
              </button>
            </div>
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
              {PHOTO_UPLOAD_ON && (
                <div
                  role="note"
                  style={{
                    border: "2px dashed #FFD27A",
                    borderRadius: 14,
                    padding: "10px 12px",
                    fontSize: 13,
                    color: "#CFE6F0",
                    lineHeight: 1.4,
                  }}
                >
                  <b>Photo policy.</b> Do not photograph faces, people or number plates. Photos are saved in a database
                  {IS_PUBLIC_DEMO ? " (deleted after 24 hours on this public demo)" : ""}. If one slips in, retake it
                  before you submit.
                </div>
              )}
              {!before ? (
                <>
                  <div style={{ fontSize: 14, color: "#CFE6F0", lineHeight: 1.4 }}>
                    <b>Step 1.</b> Photograph the GPT as you found it. GPT only, no people or number plates.
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
                  sub={PHOTO_UPLOAD_ON ? "Sent for review on submit" : "Used to improve the AI"}
                />
              )}
              {before && PHOTO_UPLOAD_ON && (
                <div>
                  <button
                    className="fr-btn fr-ghost"
                    type="button"
                    style={{ width: "100%", minHeight: 40 }}
                    onClick={() => {
                      const f = photos[photoKey]?.beforeFile;
                      setMocks((m) => ({ ...m, [photoKey]: mockSuggestion(stop.pct, f ? f.size : 0) }));
                    }}
                  >
                    {mock ? "Run mock AI check again" : "Run mock AI check"}
                  </button>
                  <div aria-live="polite" style={{ fontSize: 13, lineHeight: 1.4, color: "#CFE6F0", marginTop: 6 }}>
                    {mock ? (
                      <>
                        <b style={{ color: "#FFD27A" }}>
                          Mock result: level {mock.level} · {MOCK_NAMES[mock.level]}
                        </b>{" "}
                        · confidence {Math.round(mock.confidence * 100)}%
                        <br />
                        This is a mock for the demo, not a real model. It does not look at the photo.
                      </>
                    ) : (
                      "Mock only in this demo: no real model is called."
                    )}
                  </div>
                </div>
              )}
              {before && !after && (
                <>
                  <div style={{ fontSize: 14, color: "#CFE6F0", lineHeight: 1.4 }}>
                    <b>Step 2.</b> Clear the leaves and debris, then photograph the clean GPT.
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
                {PHOTO_UPLOAD_ON
                  ? `On submit, both photos are shrunk, stripped of location data and saved to the sample project for review.${
                      IS_PUBLIC_DEMO ? " On this public demo they are deleted after 24 hours." : ""
                    } They are not used for training.`
                  : "Photos stay on this device in memory in this demo. The real app would stamp time and location on each photo."}
              </div>
            </div>
          )}
          {run!.accepted && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 16,
                paddingTop: 14,
                borderTop: "2px solid #1E4A63",
              }}
            >
              <button
                className="fr-btn fr-sec"
                type="button"
                style={{ flex: 1, minHeight: 44 }}
                onClick={() => setAsking("skip")}
              >
                Skip this stop
              </button>
              <button
                className="fr-btn fr-ghost"
                type="button"
                style={{ flex: 1, minHeight: 44 }}
                onClick={() => setAsking("end")}
              >
                End run early
              </button>
            </div>
          )}
          {(run!.skipped ?? []).length > 0 && (
            <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.4, color: "#8FB8CC" }}>
              {run!.skipped!.map((k) => (
                <div key={k.stopId}>
                  Skipped {k.stopId}: {reasonLabel(k.reason)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <p style={{ marginTop: 16, fontSize: 12, color: "#8FB8CC" }}>Sample data. Signed in as {crewName}.</p>
      {asking && run && stop && (
        <ReasonDialog
          kind={asking}
          stopId={stop.id}
          doneCount={run.done.length}
          openCount={openStops(run).length}
          onConfirm={(reason, note) => leave(asking, reason, note)}
          onCancel={() => setAsking(null)}
        />
      )}
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
