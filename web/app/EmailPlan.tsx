"use client";

import { useState } from "react";
import Dialog from "./Dialog";
import { maskAddress, validAddress } from "../../planner/src/sendReport";
import { buildPlanEmail, type PlanEmailStop } from "../../planner/src/planEmail";
import { renderPlanHtml } from "../../planner/src/planEmailHtml";

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
  stops: (Omit<PlanEmailStop, "hasCamera"> & { photosNeeded: boolean })[];
  capacity: number;
}) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [shown, setShown] = useState<{ masked: string; subject: string; body: string; html: string } | null>(null);
  const [view, setView] = useState<"designed" | "text">("designed");
  const valid = validAddress(to.trim());

  function simulate() {
    const date = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Sydney", dateStyle: "full" }).format(
      new Date(),
    );
    const list: PlanEmailStop[] = stops.map(({ photosNeeded, ...s }) => ({ ...s, hasCamera: !photosNeeded }));
    const mail = buildPlanEmail(list, capacity, date);
    // The logo path is made absolute for this preview only (srcDoc has no base URL).
    const html = renderPlanHtml(list, capacity, date, { logoSrc: `${window.location.origin}/brand-wordmark.png` });
    setView("designed");
    setShown({ masked: maskAddress(to.trim()), ...mail, html });
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
          maxWidth={680}
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
            Sends the {stops.length} {stops.length === 1 ? "stop" : "stops"} of this plan to one address. The crew gets
            the same designed email as the admin report, read-only and with no link back to the admin. Crews are never
            emailed automatically: reminders go to the admin only, and this goes out only when you press Send. In this
            demo nothing is really sent.
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
              <div style={{ display: "flex", gap: 8, margin: "8px 0" }}>
                <button
                  type="button"
                  className={`fr-btn ${view === "designed" ? "fr-sec" : "fr-ghost"}`}
                  aria-pressed={view === "designed"}
                  onClick={() => setView("designed")}
                >
                  Designed
                </button>
                <button
                  type="button"
                  className={`fr-btn ${view === "text" ? "fr-sec" : "fr-ghost"}`}
                  aria-pressed={view === "text"}
                  onClick={() => setView("text")}
                >
                  Plain text
                </button>
              </div>
              {view === "designed" ? (
                <iframe
                  title="Plan email as the crew sees it"
                  sandbox="allow-same-origin"
                  srcDoc={shown.html}
                  style={{
                    width: "100%",
                    height: 420,
                    border: "2px solid var(--fr-line)",
                    borderRadius: 12,
                    background: "#F3F7FA",
                  }}
                />
              ) : (
                <pre
                  tabIndex={0}
                  style={{
                    margin: 0,
                    maxHeight: 420,
                    overflow: "auto",
                    whiteSpace: "pre-wrap",
                    fontFamily: "inherit",
                    fontSize: 14,
                    color: "var(--fr-soft)",
                  }}
                >
                  {shown.body}
                </pre>
              )}
            </div>
          )}
        </Dialog>
      )}
    </>
  );
}
