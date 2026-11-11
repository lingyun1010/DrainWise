"use client";

import { useState } from "react";
import Dialog from "./Dialog";
import { maskAddress, validAddress } from "../../planner/src/sendReport";
import { buildPlanEmail } from "../../planner/src/planEmail";

const field: React.CSSProperties = {
  minHeight: 40,
  padding: "6px 12px",
  borderRadius: 12,
  border: "2px solid var(--fr-line)",
  background: "var(--fr-bg)",
  color: "inherit",
  font: "inherit",
  boxSizing: "border-box",
  width: "100%",
};

// "Email this plan to a crew": a manual step. Crews are never emailed automatically; the admin types the address and
// the admin key, then presses Send. The key and the address stay in this dialog's memory only.
// "Email this plan to a crew": a manual step, and SIMULATED in this demo: nothing leaves the browser. It shows the email
// that would go out. Crews are never emailed automatically; only the admin starts it, and types the address.
export default function EmailPlan({
  stops,
  capacity,
}: {
  stops: { id: string; photosNeeded: boolean }[];
  capacity: number;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [shown, setShown] = useState<{ masked: string; subject: string; body: string } | null>(null);
  const valid = validAddress(to.trim());

  function simulate() {
    const date = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", dateStyle: "full" }).format(
      new Date(),
    );
    const mail = buildPlanEmail(
      stops.map((s) => ({ id: s.id, hasCamera: !s.photosNeeded })),
      capacity,
      date,
    );
    setShown({ masked: maskAddress(to.trim()), ...mail });
  }

  return (
    <>
      <button
        type="button"
        className="fr-btn fr-sec"
        style={{ marginTop: 8 }}
        onClick={() => {
          setShown(null);
          setOpen(true);
        }}
      >
        Email this plan to a crew
      </button>
      {open && (
        <Dialog
          label="Email this plan to a crew"
          eyebrow="Email (simulated)"
          title="Email this plan to a crew"
          onClose={() => setOpen(false)}
          actions={
            <>
              <button type="button" className="fr-btn fr-pri" disabled={!valid} onClick={simulate}>
                Send plan (simulated)
              </button>
              <button type="button" className="fr-btn fr-ghost" onClick={() => setOpen(false)}>
                {shown ? "Close" : "Cancel"}
              </button>
            </>
          }
        >
          <p style={{ margin: "0 0 10px" }}>
            Sends the {stops.length} stops of this plan to one address. Crews are never emailed automatically: reminders
            go to the admin only, and this goes out only when you press Send. In this demo nothing is really sent.
          </p>
          <label style={{ display: "grid", gap: 4 }}>
            Crew email address
            <input type="email" autoComplete="off" value={to} onChange={(e) => setTo(e.target.value)} style={field} />
          </label>
          {shown && (
            <div role="status" style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, color: "#7ED9A3" }}>
                Simulated: nothing was sent. This is the email that would go to {shown.masked}.
              </div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>{shown.subject}</div>
              <pre
                style={{
                  margin: "6px 0 0",
                  maxHeight: 200,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  fontFamily: "inherit",
                  fontSize: 14,
                  color: "var(--fr-soft)",
                }}
              >
                {shown.body}
              </pre>
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
