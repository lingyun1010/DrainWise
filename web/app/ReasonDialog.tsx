"use client";

import { useState } from "react";

import Dialog from "./Dialog";
import { endsRun, reasonsFor, type Reason } from "../../planner/src/runActions";

// Crew picks why they decline a run, skip a stop or end the run early. Same Dialog as every other popup.
// Focus starts on the quiet button so Enter never ends a run by accident.
export type ReasonKind = "decline" | "skip" | "end";

const COPY: Record<ReasonKind, { eyebrow: string; title: string; confirm: string; keep: string }> = {
  decline: { eyebrow: "Decline run", title: "Decline this run?", confirm: "Decline run", keep: "Keep the run" },
  skip: { eyebrow: "Skip stop", title: "Skip this stop?", confirm: "Skip stop", keep: "Keep going" },
  end: { eyebrow: "End run early", title: "End the run early?", confirm: "End run", keep: "Keep going" },
};

export default function ReasonDialog({
  kind,
  stopId,
  doneCount,
  openCount,
  onConfirm,
  onCancel,
}: {
  kind: ReasonKind;
  stopId?: string; // the stop being skipped
  doneCount: number; // stops already cleaned in this run
  openCount: number; // stops not yet cleaned or skipped
  onConfirm: (reason: Reason, note?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState("");
  const c = COPY[kind];
  const wholeRun = kind !== "skip" || (reason !== null && endsRun(reason));
  const back = kind === "skip" && !wholeRun ? 1 : openCount;

  return (
    <Dialog
      label={c.title}
      eyebrow={c.eyebrow}
      title={kind === "skip" && stopId ? `Skip ${stopId}?` : c.title}
      tone="danger"
      onClose={onCancel}
      actions={
        <>
          <button
            className="fr-btn fr-pri"
            type="button"
            disabled={!reason}
            onClick={() => reason && onConfirm(reason, note.trim() || undefined)}
          >
            {kind === "skip" && wholeRun && reason ? "End run" : c.confirm}
          </button>
          <button className="fr-btn fr-ghost" type="button" autoFocus onClick={onCancel}>
            {c.keep}
          </button>
        </>
      }
    >
      <p style={{ margin: "0 0 12px" }}>Why? Pick one so the manager knows what happened.</p>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <legend className="sr-only">Reason</legend>
        {reasonsFor(kind, doneCount).map((r) => {
          const on = reason === r.id;
          return (
            <label
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minHeight: 44,
                padding: "6px 12px",
                borderRadius: 12,
                cursor: "pointer",
                background: "#0B2233",
                border: `2px solid ${on ? "#4FC3E8" : "#1E4A63"}`,
                color: "#EAF6FB",
                fontWeight: on ? 700 : 500,
              }}
            >
              <input
                type="radio"
                name="reason"
                value={r.id}
                checked={on}
                onChange={() => setReason(r.id)}
                style={{ accentColor: "#4FC3E8", width: 18, height: 18 }}
              />
              {r.label}
            </label>
          );
        })}
      </fieldset>
      {reason === "other" && (
        <input
          aria-label="What happened (optional)"
          placeholder="What happened? (optional)"
          maxLength={80}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{
            width: "100%",
            marginTop: 10,
            minHeight: 44,
            boxSizing: "border-box",
            background: "#0B2233",
            color: "#EAF6FB",
            border: "2px solid #1E4A63",
            borderRadius: 12,
            padding: "6px 12px",
            fontSize: 15,
            fontFamily: "inherit",
          }}
        />
      )}
      <p style={{ margin: "12px 0 0", fontSize: 14, color: "#8FB8CC" }}>
        {kind === "skip" && !wholeRun
          ? `${stopId ?? "This stop"} goes back to the queue. You carry on with the next stop.`
          : `${back} stop${back === 1 ? "" : "s"} go${back === 1 ? "es" : ""} back to the queue.${
              doneCount > 0 ? ` ${doneCount} cleaned stop${doneCount === 1 ? " stays" : "s stay"} in the records.` : ""
            }`}
        {kind === "skip" && wholeRun && reason ? " This reason ends the whole run." : ""}
      </p>
    </Dialog>
  );
}
