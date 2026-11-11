"use client";

import { useState } from "react";
import Dialog from "./Dialog";
import { MAX_NOTE, REMOVE_REASONS, reasonError, type RemoveReasonId } from "../../planner/src/planReview";

// The admin takes a planned GPT out of the suggested run and says why. Same Dialog and the same radio rows as the crew's
// ReasonDialog. Nothing is deleted: the GPT goes back to Check next, and the reason is kept as evidence.
export default function RemoveStopDialog({
  stopId,
  onConfirm,
  onCancel,
}: {
  stopId: string;
  onConfirm: (reason: RemoveReasonId, note: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<RemoveReasonId | null>(null);
  const [note, setNote] = useState("");
  const err = reasonError(reason, note);
  return (
    <Dialog
      label={`Remove ${stopId} from the run`}
      eyebrow="Remove from run"
      title={`Remove ${stopId}?`}
      tone="danger"
      onClose={onCancel}
      actions={
        <>
          <button
            className="fr-btn fr-pri"
            type="button"
            disabled={!!err}
            onClick={() => reason && onConfirm(reason, note.trim())}
          >
            Remove {stopId}
          </button>
          <button className="fr-btn fr-ghost" type="button" autoFocus onClick={onCancel}>
            Keep in the run
          </button>
        </>
      }
    >
      <p style={{ margin: "0 0 12px" }}>Why? Pick one. DrainWise keeps it as evidence, nothing changes by itself.</p>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        <legend className="sr-only">Reason</legend>
        {REMOVE_REASONS.map((r) => {
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
                name="remove-reason"
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
      {reason && (
        <input
          aria-label={reason === "other" ? "Write why (required)" : "Note (optional)"}
          placeholder={reason === "other" ? "Write why (required)" : "Note (optional)"}
          maxLength={MAX_NOTE}
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
        {stopId} goes back to Check next. You can add it again later.
      </p>
    </Dialog>
  );
}
