"use client";

import { useState } from "react";
import {
  MAX_NOTE,
  REMOVE_REASONS,
  canConfirm,
  editReasonText,
  reasonError,
  rememberLines,
  tidyEdits,
  totalLoad,
  type PlanEdit,
  type PlanStop,
  type RemoveReasonId,
} from "../../planner/src/planReview";

// Editing state for one run suggestion. Used by the Manager dialog and the /plan page, so both behave the same.
// The admin removes stops (each needs a reason), sees what will be remembered, and confirms. Nothing is applied silently.
export function usePlanEditor(
  proposed: PlanStop[],
  capacity: number,
  initialRemoved: Record<string, { reason: RemoveReasonId; note: string }> = {},
) {
  const [removed, setRemoved] = useState<Record<string, { reason: RemoveReasonId; note: string }>>(() =>
    Object.fromEntries(Object.entries(initialRemoved).filter(([id]) => proposed.some((p) => p.id === id))),
  );
  const [open, setOpen] = useState<string | null>(null); // stop whose reason picker is showing
  const [draft, setDraft] = useState<{ reason: RemoveReasonId | null; note: string }>({ reason: null, note: "" });
  const [error, setError] = useState<string | null>(null);

  const final = proposed.filter((s) => !removed[s.id]);
  const edits: PlanEdit[] = tidyEdits(
    proposed,
    final,
    Object.entries(removed).map(([id, r]) => ({
      id,
      action: "remove" as const,
      reason: r.reason,
      note: r.note.trim() || undefined,
    })),
  );
  const check = canConfirm(proposed, final, edits, capacity);

  function start(id: string) {
    setOpen(id);
    setDraft({ reason: null, note: "" });
    setError(null);
  }
  function applyRemoval() {
    const err = reasonError(draft.reason, draft.note);
    if (err || !open || !draft.reason) return setError(err);
    setRemoved({ ...removed, [open]: { reason: draft.reason, note: draft.note } });
    setOpen(null);
  }
  function putBack(id: string) {
    const next = { ...removed };
    delete next[id];
    setRemoved(next);
  }
  return {
    final,
    edits,
    check,
    removed,
    open,
    draft,
    setDraft,
    error,
    start,
    applyRemoval,
    putBack,
    cancelPick: () => setOpen(null),
  };
}

export type PlanEditorState = ReturnType<typeof usePlanEditor>;

export function PlanEditorBody({
  ed,
  proposed,
  capacity,
  tierOf,
}: {
  ed: PlanEditorState;
  proposed: PlanStop[];
  capacity: number;
  tierOf?: (id: string) => string;
}) {
  const load = totalLoad(ed.final);
  return (
    <div>
      <p style={{ margin: "0 0 10px", fontSize: 14, color: "#8FB8CC", lineHeight: 1.4 }}>
        This run is a suggestion. Remove any GPT you do not want in it and say why. Nothing is sent until you confirm.
      </p>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {proposed.map((s, i) => {
          const gone = ed.removed[s.id];
          return (
            <li key={s.id} style={{ background: "#0B2233", borderRadius: 12, padding: "8px 12px", fontSize: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ opacity: gone ? 0.6 : 1, textDecoration: gone ? "line-through" : "none" }}>
                  <b>
                    {i + 1}. {s.id}
                  </b>
                  {tierOf ? ` · ${tierOf(s.id)}` : ""} · {s.load.toFixed(2)} m³
                </span>
                {gone ? (
                  <button className="fr-btn fr-ghost" type="button" onClick={() => ed.putBack(s.id)}>
                    Put {s.id} back
                  </button>
                ) : (
                  <button
                    className="fr-btn fr-sec"
                    type="button"
                    aria-expanded={ed.open === s.id}
                    onClick={() => (ed.open === s.id ? ed.cancelPick() : ed.start(s.id))}
                  >
                    Remove {s.id}
                  </button>
                )}
              </div>
              {gone && (
                <div style={{ marginTop: 4, fontSize: 13, color: "#FFD27A" }}>Removed: {editReasonText(gone)}</div>
              )}
              {ed.open === s.id && (
                <fieldset style={{ border: 0, margin: "10px 0 2px", padding: 0 }}>
                  <legend style={{ fontSize: 13, color: "#B9D6E3", marginBottom: 6 }}>Why remove {s.id}?</legend>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {REMOVE_REASONS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={`fr-btn ${ed.draft.reason === r.id ? "fr-pri" : "fr-sec"}`}
                        aria-pressed={ed.draft.reason === r.id}
                        onClick={() => ed.setDraft({ ...ed.draft, reason: r.id })}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <label style={{ display: "block", marginTop: 8, fontSize: 13, color: "#B9D6E3" }}>
                    {ed.draft.reason === "other" ? "Write why (required)" : "Note (optional)"}
                    <input
                      type="text"
                      value={ed.draft.note}
                      maxLength={MAX_NOTE}
                      onChange={(e) => ed.setDraft({ ...ed.draft, note: e.target.value })}
                      style={{
                        display: "block",
                        width: "100%",
                        marginTop: 4,
                        minHeight: 40,
                        borderRadius: 10,
                        border: "2px solid #1E4A63",
                        background: "#071A28",
                        color: "#E8F4FA",
                        padding: "0 10px",
                        fontSize: 15,
                      }}
                    />
                  </label>
                  {ed.error && (
                    <div role="alert" style={{ marginTop: 6, fontSize: 13, color: "#FFB38A" }}>
                      {ed.error}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="fr-btn fr-pri" type="button" onClick={ed.applyRemoval}>
                      Remove {s.id}
                    </button>
                    <button className="fr-btn fr-ghost" type="button" onClick={ed.cancelPick}>
                      Cancel
                    </button>
                  </div>
                </fieldset>
              )}
            </li>
          );
        })}
      </ol>
      <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700 }}>
        Final run: {ed.final.length} of {proposed.length} stops · {load.toFixed(1)} of {capacity.toFixed(1)} m³
      </div>
      {ed.edits.length > 0 && (
        <div style={{ marginTop: 10, background: "#0B2233", borderRadius: 12, padding: "8px 12px" }}>
          <div className="fr-label">What DrainWise will remember</div>
          <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
            {rememberLines(ed.edits).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <div style={{ marginTop: 4, fontSize: 12, color: "#8FB8CC" }}>
            Saved as evidence only. DrainWise does not change its rules from this by itself; you approve any rule first.
          </div>
        </div>
      )}
      {!ed.check.ok && ed.edits.length > 0 && (
        <div role="alert" style={{ marginTop: 8, fontSize: 13, color: "#FFB38A" }}>
          {ed.check.error}
        </div>
      )}
    </div>
  );
}
