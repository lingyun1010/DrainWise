"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  HIDDEN_PREFERENCES,
  SIMULATION_LABEL,
  rollingAcceptance,
  summarise,
  type SimWeek,
} from "../../../planner/src/simulate";
import type { EvidenceEdit } from "../../../planner/src/reflect";
import Dialog, { ConfirmDialog } from "../Dialog";

type Lesson = {
  id: string;
  statement: string;
  kind: string;
  edit_ids: string[];
  count: number;
  status: "proposed" | "approved" | "rejected";
};
type Pref = {
  id: string;
  lesson_id: string;
  text: string;
  enabled: boolean;
  version: number;
  approved_at_week: number | null;
};
type Data = { weeks: SimWeek[]; lessons: Lesson[]; prefs: Pref[]; evidence: EvidenceEdit[] };

const HIDDEN: Record<string, string> = {
  creek_first: HIDDEN_PREFERENCES.creek,
  drop_far_after_rain: HIDDEN_PREFERENCES.rain,
};

async function send(url: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const d = (await r.json().catch(() => ({}))) as { error?: string; message?: string };
    return r.ok ? null : (d.message ?? d.error ?? "Something went wrong.");
  } catch {
    return "The server is not reachable.";
  }
}

function LineChart({
  values,
  marks,
  max,
  label,
  fmt,
}: {
  values: number[];
  marks: number[];
  max: number;
  label: string;
  fmt: (n: number) => string;
}) {
  const W = 560;
  const H = 150;
  const pad = 28;
  const n = Math.max(values.length, 2);
  const x = (i: number) => pad + (i * (W - pad - 8)) / (n - 1);
  const y = (v: number) => H - 22 - (v / max) * (H - 40);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <line x1={pad} y1={y(0)} x2={W - 8} y2={y(0)} stroke="#2D6182" />
      <text x={4} y={y(max) + 4} fontSize="11" fill="#8FB8CC">
        {fmt(max)}
      </text>
      <text x={4} y={y(0)} fontSize="11" fill="#8FB8CC">
        0
      </text>
      {marks.map((m) => (
        <g key={m}>
          <line
            x1={x(m) - 0.5 * ((W - pad - 8) / (n - 1))}
            y1={8}
            x2={x(m) - 0.5 * ((W - pad - 8) / (n - 1))}
            y2={y(0)}
            stroke="#7ED9A3"
            strokeDasharray="4 3"
          />
          <text x={x(m) - 0.5 * ((W - pad - 8) / (n - 1)) + 4} y={16} fontSize="11" fill="#7ED9A3">
            Rule approved
          </text>
        </g>
      ))}
      {values.length > 1 && (
        <polyline
          fill="none"
          stroke="#4FC3E8"
          strokeWidth="3"
          points={values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
        />
      )}
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="4" fill="#4FC3E8" />
          <title>{`Week ${i + 1}: ${fmt(v)}`}</title>
        </g>
      ))}
      <text x={W - 8} y={H - 4} fontSize="11" fill="#8FB8CC" textAnchor="end">
        Simulated week →
      </text>
    </svg>
  );
}

export default function LearningClient() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<Lesson | null>(null);
  const [editing, setEditing] = useState<{ lesson: Lesson; text: string } | null>(null);
  const [rejecting, setRejecting] = useState<Lesson | null>(null);
  const [resetting, setResetting] = useState(false);

  const [tick, setTick] = useState(0); // bump to reload
  useEffect(() => {
    let live = true;
    fetch("/api/learning", { cache: "no-store" })
      .then(async (r) => ({ ok: r.ok, d: (await r.json()) as Data & { error?: string } }))
      .then(({ ok, d }) => {
        if (!live) return;
        if (ok) {
          setErr(null);
          setData(d);
        } else setErr(d.error ?? "Could not load.");
      })
      .catch(() => live && setErr("The server is not reachable."));
    return () => {
      live = false;
    };
  }, [tick]);

  async function act(name: string, run: () => Promise<string | null>) {
    setBusy(name);
    setMsg(null);
    const e = await run();
    setBusy(null);
    if (e) setMsg(e);
    setTick((t) => t + 1);
  }

  const weeks = data?.weeks ?? [];
  const prefs = data?.prefs ?? [];
  const lessons = data?.lessons ?? [];
  const approvedAt = prefs.filter((p) => p.approved_at_week !== null).map((p) => p.approved_at_week as number);
  const marks = [...new Set(approvedAt)].filter((w) => w > 0 && w < weeks.length);
  const edits = weeks.map((w) => w.edits.length);
  const acc = rollingAcceptance(weeks);
  const cut = approvedAt.length ? Math.min(...approvedAt) : null;
  const before = cut === null ? null : summarise(weeks.slice(0, cut));
  const after = cut === null ? null : summarise(weeks.slice(cut));
  const lastBefore = cut === null ? null : weeks[cut - 1];
  const lastAfter = cut === null || weeks.length <= cut ? null : weeks[weeks.length - 1];
  const prefOf = (l: Lesson) => prefs.find((p) => p.lesson_id === l.id);
  const learned = (kind: string) => lessons.some((l) => l.kind === kind && l.status === "approved");
  const evById = new Map((data?.evidence ?? []).map((e) => [e.id, e]));

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 80px" }}>
      <Link href="/" className="fr-btn fr-ghost">
        Back to Manager
      </Link>
      <h1 style={{ fontSize: 28, margin: "12px 0 6px" }}>Learning from feedback</h1>
      <div
        style={{
          border: "2px solid #FFD27A",
          borderRadius: 16,
          padding: "10px 14px",
          fontSize: 14,
          lineHeight: 1.45,
          color: "#FFE3A8",
          marginBottom: 14,
        }}
      >
        {SIMULATION_LABEL}. The weeks below are made up. The Claude model&apos;s weights never change: what learns is
        the table of rules that a person approves. Nothing is applied without approval.
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 8 }}>
        <button
          className="fr-btn fr-pri"
          type="button"
          disabled={busy !== null}
          onClick={() => act("sim", () => send("/api/simulate", "POST", { weeks: 4 }))}
        >
          {busy === "sim" ? "Running…" : "Run 4 simulated weeks"}
        </button>
        <button
          className="fr-btn fr-sec"
          type="button"
          disabled={busy !== null || weeks.length === 0}
          onClick={() => act("reflect", () => send("/api/reflect", "POST"))}
        >
          {busy === "reflect" ? "Reflecting…" : "Reflect on the edits"}
        </button>
        <button
          className="fr-btn fr-ghost"
          type="button"
          disabled={busy !== null || weeks.length === 0}
          onClick={() => setResetting(true)}
        >
          Reset simulation
        </button>
      </div>
      <div role="status" style={{ minHeight: 22, fontSize: 14, color: "#FFB38A" }}>
        {msg ?? err}
      </div>

      {data && weeks.length === 0 && (
        <p style={{ color: "#CFE6F0", fontSize: 15, lineHeight: 1.5 }}>
          Step 1: run 4 simulated weeks. A made-up scheduler edits each proposed plan. Step 2: reflect on the edits.
          Step 3: approve a rule, then run 4 more weeks and watch the edits fall.
        </p>
      )}

      {weeks.length > 0 && (
        <>
          <section aria-label="Edits per plan" style={{ marginTop: 10 }}>
            <h2 style={{ fontSize: 18, margin: "10px 0 4px" }}>Edits per plan (simulation)</h2>
            <LineChart
              values={edits}
              marks={marks}
              max={Math.max(4, ...edits)}
              label="Edits per plan for each simulated week"
              fmt={(n) => String(n)}
            />
          </section>
          <section aria-label="Plan acceptance" style={{ marginTop: 10 }}>
            <h2 style={{ fontSize: 18, margin: "10px 0 4px" }}>
              Plans accepted without edits, last 4 weeks (simulation)
            </h2>
            <LineChart
              values={acc}
              marks={marks}
              max={1}
              label="Share of plans accepted without edits"
              fmt={(n) => `${Math.round(n * 100)}%`}
            />
          </section>

          {before && after && weeks.length > (cut ?? 0) && (
            <section
              aria-label="Before and after"
              style={{ marginTop: 14, border: "2px solid #2D6182", borderRadius: 18, padding: 14 }}
            >
              <h2 style={{ fontSize: 18, margin: "0 0 8px" }}>Before and after the first approved rule</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: 12,
                  fontSize: 14,
                }}
              >
                <div>
                  <b>Before: {before.editsPerPlan.toFixed(1)} edits per plan</b>
                  {lastBefore && (
                    <div style={{ color: "#8FB8CC" }}>
                      Week {lastBefore.week + 1}: {lastBefore.proposed.length} stops proposed, {lastBefore.edits.length}{" "}
                      edits. No rules used.
                    </div>
                  )}
                </div>
                <div>
                  <b>After: {after.editsPerPlan.toFixed(1)} edits per plan</b>
                  {lastAfter && (
                    <div style={{ color: "#8FB8CC" }}>
                      Week {lastAfter.week + 1}: {lastAfter.proposed.length} stops proposed, {lastAfter.edits.length}{" "}
                      edits.
                      {lastAfter.rulesUsed.length > 0 && (
                        <> Adjusted by rule: {lastAfter.rulesUsed.map((t) => t.replace(/\.$/, "")).join(", ")}.</>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {lessons.length > 0 && (
        <section aria-label="Rules" style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Rules</h2>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#8FB8CC", lineHeight: 1.4 }}>
            Claude drafted these from the edits (at least 3 edits each; 3 is an assumption). The distance cut-off and
            the boost are fixed defaults, not learned.
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 }}>
            {lessons.map((l) => {
              const p = prefOf(l);
              const state =
                l.status === "approved"
                  ? p && !p.enabled
                    ? "Approved, switched off"
                    : "Approved"
                  : l.status === "rejected"
                    ? "Rejected"
                    : "Proposed";
              return (
                <li key={l.id} style={{ border: "2px solid #2D6182", borderRadius: 18, padding: 14 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: ".06em",
                      color: l.status === "approved" ? "#7ED9A3" : "#8FD8F0",
                    }}
                  >
                    {state.toUpperCase()}
                    {p ? ` · VERSION ${p.version}` : ""}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 700, margin: "4px 0" }}>{p?.text ?? l.statement}</div>
                  <div style={{ fontSize: 13, color: "#8FB8CC" }}>{l.count} supporting edits</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                    {l.status === "proposed" && (
                      <button
                        className="fr-btn fr-pri"
                        type="button"
                        disabled={busy !== null}
                        onClick={() =>
                          act("approve", () => send("/api/rules", "PATCH", { lessonId: l.id, action: "approve" }))
                        }
                      >
                        Approve rule
                      </button>
                    )}
                    {l.status === "approved" && p && (
                      <>
                        <label
                          style={{ display: "inline-flex", alignItems: "center", gap: 8, minHeight: 40, fontSize: 15 }}
                        >
                          <input
                            type="checkbox"
                            style={{ width: 20, height: 20 }}
                            checked={p.enabled}
                            onChange={(e) =>
                              act("toggle", () =>
                                send("/api/rules", "PATCH", {
                                  lessonId: l.id,
                                  action: "toggle",
                                  enabled: e.target.checked,
                                }),
                              )
                            }
                          />
                          {p.enabled ? "Rule is on" : "Rule is off"}
                        </label>
                        <button
                          className="fr-btn fr-sec"
                          type="button"
                          onClick={() => setEditing({ lesson: l, text: p.text })}
                        >
                          Edit text
                        </button>
                      </>
                    )}
                    <button className="fr-btn fr-sec" type="button" onClick={() => setEvidenceFor(l)}>
                      Show evidence
                    </button>
                    {l.status !== "rejected" && (
                      <button className="fr-btn fr-ghost" type="button" onClick={() => setRejecting(l)}>
                        Reject rule
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {weeks.length > 0 && (
        <section aria-label="Hidden and learned" style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 18, margin: "0 0 4px" }}>Did it find the hidden preferences?</h2>
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#8FB8CC" }}>
            The persona&apos;s two preferences were set by us. We know the answer, so we can check.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "#8FB8CC" }}>
                <th style={{ padding: "6px 4px" }}>Hidden (simulation)</th>
                <th style={{ padding: "6px 4px" }}>Learned</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(HIDDEN).map(([kind, text]) => {
                const l = lessons.find((x) => x.kind === kind && x.status === "approved");
                return (
                  <tr key={kind} style={{ borderTop: "1px solid #1E4A63" }}>
                    <td style={{ padding: "8px 4px" }}>{text}</td>
                    <td style={{ padding: "8px 4px" }}>
                      {learned(kind) && l ? `Recovered: ${prefOf(l)?.text ?? l.statement}` : "Not found yet"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {evidenceFor && (
        <Dialog
          label="Evidence for a rule"
          eyebrow="Evidence"
          title={evidenceFor.statement}
          onClose={() => setEvidenceFor(null)}
          actions={
            <button className="fr-btn fr-ghost" type="button" onClick={() => setEvidenceFor(null)}>
              Close
            </button>
          }
        >
          <p style={{ margin: "0 0 8px", fontSize: 13, color: "#8FB8CC" }}>
            Edits made by the simulated scheduler that support this rule.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, maxHeight: 260, overflowY: "auto" }}>
            {evidenceFor.edit_ids.map((id) => {
              const e = evById.get(id);
              return (
                <li key={id}>{e ? `${e.action === "add" ? "Added" : "Removed"} ${e.assetId}: ${e.reason}` : id}</li>
              );
            })}
          </ul>
        </Dialog>
      )}

      {editing && (
        <Dialog
          label="Edit rule text"
          eyebrow="Rule"
          title="Edit the rule text"
          onClose={() => setEditing(null)}
          actions={
            <>
              <button
                className="fr-btn fr-pri"
                type="button"
                disabled={editing.text.trim() === ""}
                onClick={() => {
                  const e = editing;
                  setEditing(null);
                  void act("edit", () =>
                    send("/api/rules", "PATCH", { lessonId: e.lesson.id, action: "edit", text: e.text }),
                  );
                }}
              >
                Save new version
              </button>
              <button className="fr-btn fr-ghost" type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </>
          }
        >
          <label style={{ display: "block", fontSize: 14, marginBottom: 6 }} htmlFor="rule-text">
            Rule text (the rule&apos;s behaviour stays the same)
          </label>
          <input
            id="rule-text"
            value={editing.text}
            maxLength={200}
            onChange={(e) => setEditing({ ...editing, text: e.target.value })}
            style={{
              width: "100%",
              minHeight: 40,
              borderRadius: 12,
              border: "2px solid #2D6182",
              background: "#0B2233",
              color: "#EAF6FB",
              padding: "0 12px",
              fontSize: 16,
            }}
          />
        </Dialog>
      )}

      {rejecting && (
        <ConfirmDialog
          label="Reject rule"
          eyebrow="Reject"
          title="Reject this rule?"
          tone="danger"
          confirmLabel="Reject rule"
          onCancel={() => setRejecting(null)}
          onConfirm={() => {
            const l = rejecting;
            setRejecting(null);
            void act("reject", () => send("/api/rules", "PATCH", { lessonId: l.id, action: "reject" }));
          }}
        >
          The planner will not use &quot;{rejecting.statement}&quot;. The supporting edits stay on record.{" "}
          {prefOf(rejecting)
            ? "This rule is currently in use, so plans change straight away."
            : "It was never applied."}
        </ConfirmDialog>
      )}

      {resetting && (
        <ConfirmDialog
          label="Reset simulation"
          eyebrow="Reset"
          title="Reset the simulation?"
          tone="danger"
          confirmLabel="Reset simulation"
          onCancel={() => setResetting(false)}
          onConfirm={() => {
            setResetting(false);
            void act("reset", () => send("/api/simulate", "DELETE"));
          }}
        >
          This deletes the simulated weeks, all proposed and approved rules and their versions. Real run records and
          photos are not touched. The planner goes back to plans with no rules.
        </ConfirmDialog>
      )}
    </main>
  );
}
