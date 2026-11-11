"use client";

import Link from "next/link";
import { useState } from "react";
import Dialog, { ConfirmDialog } from "../Dialog";
import { addLog, loadState, saveState, sydneyClock } from "@/lib/runStore";
import { validAddress } from "../../../planner/src/sendReport";
import { STORM_MIN_CHANCE_PCT, STORM_MIN_MM } from "../../../planner/src/reportRule";

type Force = "bom" | "storm" | "calm";
type Preview = {
  decision: { kind: "none" | "storm_alert" | "weekly_7day"; reason: string };
  report: { subject: string; body: string; empty: boolean; send: boolean } | null;
  html: string | null;
  forecastSource: string;
  tomorrow: string;
};
type Ask = { state: "idle" } | { state: "loading" } | { state: "done"; p: Preview } | { state: "error"; msg: string };

const FORCES: { id: Force; label: string; hint: string }[] = [
  { id: "bom", label: "Real BoM forecast", hint: "Uses today's forecast and the send history of this server." },
  { id: "storm", label: "Force storm tomorrow", hint: "Demo only: shows the storm alert." },
  { id: "calm", label: "Force no storm", hint: "Demo only: shows the weekly 7-day report." },
];
const RULE_NAME = {
  storm_alert: "Storm alert",
  weekly_7day: "Weekly: 7-day report",
  none: "No report",
} as const;
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
  maxWidth: 360,
};

export default function ReportClient() {
  const [force, setForce] = useState<Force>("bom");
  const [to, setTo] = useState("");
  const [key, setKey] = useState(""); // admin key, typed now, kept in memory only
  const [ask, setAsk] = useState<Ask>({ state: "idle" });
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [open, setOpen] = useState(false); // Preview dialog
  const [view, setView] = useState<"designed" | "text">("designed"); // which version of the mail the dialog shows

  async function preview() {
    setAsk({ state: "loading" });
    setResult(null);
    try {
      const res = await fetch("/api/report-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      setAsk({ state: "done", p: data });
      setView("designed");
      setOpen(true);
    } catch (e) {
      setAsk({ state: "error", msg: e instanceof Error ? e.message : "request failed" });
    }
  }

  async function send() {
    setConfirm(false);
    setSending(true);
    try {
      const res = await fetch("/api/send-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-report-key": key },
        body: JSON.stringify({ to: to.trim(), force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
      if (data.sent) {
        // Activity log: masked address and the rule only, never the full address.
        const st = loadState();
        saveState({
          ...st,
          log: addLog(
            st.log,
            sydneyClock(),
            `Email report sent to ${data.masked} (${RULE_NAME[data.rule as keyof typeof RULE_NAME]})`,
            { bot: true },
          ),
        });
        setResult({
          ok: true,
          msg: `Sent to ${data.masked}. Rule: ${RULE_NAME[data.rule as keyof typeof RULE_NAME]}.`,
        });
      } else {
        setResult({ ok: true, msg: `Nothing sent. ${data.reason}` });
      }
    } catch (e) {
      setResult({ ok: false, msg: `Could not send: ${e instanceof Error ? e.message : "request failed"}` });
    } finally {
      setSending(false);
    }
  }

  const p = ask.state === "done" ? ask.p : null;
  const addressOk = validAddress(to.trim());
  const willSend = !!p && p.decision.kind !== "none" && !!p.report?.send;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 48px", display: "grid", gap: 16 }}>
      <div>
        <Link className="fr-btn fr-ghost" href="/?role=manager" style={{ textDecoration: "none" }}>
          Back to Manager
        </Link>
      </div>
      <h1 style={{ margin: 0, fontSize: 28 }}>Email report (sample data)</h1>
      <p style={{ margin: 0, color: "var(--fr-mute)", lineHeight: 1.5 }}>
        Council asked for an email with the GPTs to empty, not an app left open. Once a day the rule checks the whole
        7-day BoM forecast. No storm gives one 7-day report every 7 days. A storm on any of the 7 days gives an alert at
        once, even if the weekly report went out yesterday, and again every day until a run has been planned. Reports go
        to the admin only. GPTs are listed when their predicted chance of blocking is High (60%+).
      </p>
      <section className="fr-section" aria-label="Automatic sending">
        <div className="fr-label">Automatic sending</div>
        <p style={{ margin: "6px 0 0", lineHeight: 1.5 }}>
          Not built in this demo: there is no scheduler. In production a scheduler would run once a day and call the
          same rule (<code>decideReport</code>). Here you press Preview and Send yourself. The storm level (
          {STORM_MIN_CHANCE_PCT}% chance and {STORM_MIN_MM} mm) is our assumption, not a council level.
        </p>
      </section>

      <section className="fr-section" aria-label="Report settings" style={{ display: "grid", gap: 14 }}>
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: 8 }}>
          <legend className="fr-label" style={{ padding: 0, marginBottom: 6 }}>
            Forecast to use
          </legend>
          {FORCES.map((f) => (
            <label key={f.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="radio"
                style={{ marginTop: 2, width: 20, height: 20, flexShrink: 0 }}
                name="force"
                checked={force === f.id}
                onChange={() => {
                  setForce(f.id);
                  setAsk({ state: "idle" }); // a preview belongs to one choice; preview again before sending
                  setResult(null);
                }}
              />
              <span>
                {f.label}
                <span style={{ display: "block", fontSize: 13, color: "var(--fr-mute)" }}>{f.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="fr-label">Send to (typed now, not stored)</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="name@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={field}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="fr-label">Admin key (needed to send, not stored)</span>
          <input
            type="password"
            autoComplete="off"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            style={field}
          />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <button className="fr-btn fr-sec" type="button" onClick={preview} disabled={ask.state === "loading"}>
            {ask.state === "loading" ? "Checking" : "Preview report"}
          </button>
          <button
            className="fr-btn fr-pri"
            type="button"
            onClick={() => setConfirm(true)}
            disabled={!addressOk || !key || !willSend || sending}
          >
            {sending ? "Sending" : "Send report"}
          </button>
        </div>
        {!p && (
          <div style={{ color: "var(--fr-mute)", fontSize: 14 }}>
            Preview first. Send turns on when there is something to send and the address is valid.
          </div>
        )}
        {!willSend && p && (
          <div style={{ color: "var(--fr-mute)", fontSize: 14 }}>
            Send is off because the last preview has nothing to send.
          </div>
        )}
        {ask.state === "error" && (
          <div role="alert" style={{ color: "var(--fr-orange)" }}>
            Could not check: {ask.msg}
          </div>
        )}
        <div aria-live="polite" style={{ minHeight: 22 }}>
          {result && <span style={{ color: result.ok ? "inherit" : "var(--fr-orange)" }}>{result.msg}</span>}
        </div>
      </section>

      {open && p && (
        <Dialog
          label="Report preview"
          eyebrow="Preview"
          title={RULE_NAME[p.decision.kind]}
          maxWidth={720}
          onClose={() => setOpen(false)}
          actions={
            <button className="fr-btn fr-ghost" type="button" autoFocus onClick={() => setOpen(false)}>
              Close
            </button>
          }
        >
          <p style={{ margin: "0 0 8px", lineHeight: 1.5 }}>
            <strong>Why:</strong> {p.decision.reason}
          </p>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--fr-mute)" }}>Forecast: {p.forecastSource}</p>
          {p.report ? (
            <>
              <p style={{ margin: "0 0 4px" }}>
                <strong>To:</strong> {addressOk ? to.trim() : "(type an address first)"}
              </p>
              <p style={{ margin: "0 0 8px" }}>
                <strong>Subject:</strong> {p.report.subject}
              </p>
              {!p.report.send && (
                <p style={{ margin: "0 0 8px", color: "var(--fr-orange)" }}>
                  Nothing would be sent: a storm report with no GPT to list is skipped.
                </p>
              )}
              {p.html && (
                <div role="group" aria-label="Email version" style={{ display: "flex", gap: 8, margin: "0 0 8px" }}>
                  <button
                    className={`fr-btn ${view === "designed" ? "fr-sec" : "fr-ghost"}`}
                    type="button"
                    aria-pressed={view === "designed"}
                    onClick={() => setView("designed")}
                  >
                    Designed email
                  </button>
                  <button
                    className={`fr-btn ${view === "text" ? "fr-sec" : "fr-ghost"}`}
                    type="button"
                    aria-pressed={view === "text"}
                    onClick={() => setView("text")}
                  >
                    Plain text
                  </button>
                </div>
              )}
              {p.html && view === "designed" ? (
                <iframe
                  title="Email as the recipient sees it"
                  sandbox="allow-same-origin" // no allow-scripts: nothing in the mail can run code; same-origin only lets the logo load
                  // srcDoc has no base URL, so the logo path is made absolute for the preview only.
                  srcDoc={p.html.replace(
                    'src="/brand-wordmark.png"',
                    `src="${window.location.origin}/brand-wordmark.png"`,
                  )}
                  style={{
                    width: "100%",
                    height: 520,
                    border: "2px solid var(--fr-line)",
                    borderRadius: 12,
                    background: "#F3F7FA",
                  }}
                />
              ) : (
                <pre
                  tabIndex={0}
                  role="region"
                  aria-label="Email body"
                  style={{
                    whiteSpace: "pre-wrap",
                    margin: 0,
                    padding: 12,
                    maxHeight: 320,
                    overflow: "auto",
                    borderRadius: 12,
                    background: "var(--fr-bg)",
                    border: "2px solid var(--fr-line)",
                    font: "13px/1.5 ui-monospace, Menlo, monospace",
                  }}
                >
                  {p.report.body}
                </pre>
              )}
            </>
          ) : (
            <p style={{ margin: 0 }}>No email would be sent today.</p>
          )}
        </Dialog>
      )}

      {confirm && p?.report && (
        <ConfirmDialog
          label="Send report"
          eyebrow="Send"
          title="Send this report?"
          tone="info"
          confirmLabel="Send report"
          onConfirm={send}
          onCancel={() => setConfirm(false)}
        >
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            One email ({RULE_NAME[p.decision.kind]}) goes to {to.trim()} from the demo Gmail account. It says &quot;Demo
            with sample data&quot;. The address is not stored; the Activity log keeps only a masked form. The server
            rebuilds the report when you confirm, using the forecast at that moment.
          </p>
        </ConfirmDialog>
      )}
    </main>
  );
}
