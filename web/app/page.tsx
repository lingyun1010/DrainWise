"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { planRun, type Asset } from "../../planner/src/planRun";
import { DEPOT, makeSeedAssets } from "@/lib/seed";
import {
  DEFAULT_CREWS,
  FORECAST,
  HATS,
  addLog,
  crewLetter,
  fmtClock,
  isBusy,
  loadState,
  openStopIds,
  rainNow,
  resetAll,
  saveState,
  simMinute,
  subscribeRun,
  type RunStop,
  type SavedState,
} from "@/lib/runStore";
import MapView, { type Level, type MapAsset, type MapCrew, type MapRoute } from "./MapView";
import RoleScreen from "./RoleScreen";
import Dialog, { ConfirmDialog } from "./Dialog";
import dynamic from "next/dynamic";

// three.js is only loaded when the 3D view is opened.
const Map3D = dynamic(() => import("./Map3D"), {
  ssr: false,
  loading: () => <p style={{ padding: 16 }}>Loading 3D view…</p>,
});
import CrewApp, { CameraIcon } from "./CrewApp";

type Prediction = { asset_id: string; p_block: number; level: Level; reasons: string[] };
type Role = null | "manager" | "split";
const LOG_PREVIEW = 5; // rows shown before "Show today's full log"
type PanelTab = "queue" | "plan" | "records" | "crews";
const TABS: { id: PanelTab; label: string }[] = [
  { id: "queue", label: "Check next" },
  { id: "plan", label: "Run plan" },
  { id: "records", label: "Records" },
  { id: "crews", label: "Crews" },
];

// Only assets at Medium risk or above are worth a truck stop (matches risk-api MEDIUM_AT, a placeholder).
const MIN_RUN_RISK = 0.3;
const TIER = { high: "High", medium: "Medium", low: "Low" } as const;
const TIER_STYLE: Record<Level, React.CSSProperties> = {
  high: { background: "#FF8A4C", color: "#2A1208" },
  medium: { background: "#FFD27A", color: "#0B2233" },
  low: { background: "#4FC3E8", color: "#0B2233" },
};
const MAX_CREWS = HATS.length;

export default function Home() {
  const router = useRouter();
  const seed = useMemo(() => makeSeedAssets(), []);
  const [role, setRole] = useState<Role>(null);
  const [tab, setTab] = useState<PanelTab>("queue");
  const [leaf, setLeaf] = useState(60);
  const [extra, setExtra] = useState(0);
  const [capacity, setCapacity] = useState(2);
  const [preds, setPreds] = useState<Prediction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [st, setSt] = useState<SavedState>({ crews: DEFAULT_CREWS, runs: {}, records: [], log: [] });
  const [logOpen, setLogOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "withdraw" | "remove"; crewId: string } | null>(null);
  const [choose, setChoose] = useState<RunStop[] | null>(null); // stops waiting for the manager to pick a crew
  const [hiddenCrews, setHiddenCrews] = useState<string[]>([]); // crews unticked in the map legend
  const [cur, setCur] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [minute, setMinute] = useState(0);
  const [view, setView] = useState<"2d" | "3d">("2d");

  useEffect(() => {
    const read = () => setSt(loadState());
    read();
    const un = subscribeRun(read);
    const tick = setInterval(() => setMinute(simMinute()), 400);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sim clock lives in localStorage, only readable in the browser
    setMinute(simMinute());
    return () => {
      un();
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const records = st.records;
  const cleaned = useMemo(() => new Set(records.map((r) => r.stopId)), [records]);
  const assigned = useMemo(() => openStopIds(st), [st]);

  // Cleaned assets get days_since_clean = 0, so the model itself shows the risk reset.
  const rainForecast = Math.min(80, Math.round(10 + extra * 0.7));
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/risk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            seed.map((a) => ({
              asset_id: a.id,
              type: a.type,
              canopy_pct: a.canopyPct,
              leaf_index: leaf,
              rain_mm_7d: 20,
              rain_forecast_mm: rainForecast,
              days_since_clean: cleaned.has(a.id) ? 0 : a.daysSinceClean,
              has_camera: a.hasCamera,
            })),
          ),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "request failed");
        setPreds(data);
        setError(null);
      } catch (e) {
        setPreds(null);
        setError(e instanceof Error ? e.message : "request failed");
      }
    }, 250);
    return () => clearTimeout(t);
  }, [seed, leaf, rainForecast, cleaned]);

  const byId = useMemo(() => new Map(seed.map((a) => [a.id, a])), [seed]);
  const rows = useMemo(
    () =>
      (preds ?? []).flatMap((p) => {
        const a = byId.get(p.asset_id);
        if (!a) return []; // stale scores for an asset that no longer exists (for example after a hot reload)
        const state: MapAsset["state"] = cleaned.has(a.id) ? "done" : assigned.has(a.id) ? "busy" : "idle";
        return [{ p, a, state }];
      }),
    [preds, byId, cleaned, assigned],
  );
  const idle = useMemo(() => rows.filter((r) => r.state === "idle").sort((m, n) => n.p.p_block - m.p.p_block), [rows]);

  const plan = useMemo(() => {
    const assets: Asset[] = idle.map(({ p, a }) => ({
      id: a.id,
      type: a.type,
      risk: p.p_block,
      x: a.x,
      y: a.y,
      hasCamera: a.hasCamera,
    }));
    return planRun(assets, capacity, DEPOT, MIN_RUN_RISK);
  }, [idle, capacity]);
  const planN = new Map(plan.stops.map((s, i) => [s.id, i + 1]));
  // The manager picks a crew in a dialog after pressing a send button; busy crews are listed but disabled.
  const busy = st.crews.every((c) => isBusy(st.runs[c.id]));
  // Highest-risk assets the plan skipped, so the manager sees why a top item is missing.
  const leftOut = useMemo(() => {
    const inPlan = new Set(plan.stops.map((s) => s.id));
    return idle
      .filter(({ p, a }) => p.p_block >= MIN_RUN_RISK && !inPlan.has(a.id))
      .slice(0, 3)
      .map(({ p, a }) => {
        const one = planRun(
          [{ id: a.id, type: a.type, risk: p.p_block, x: a.x, y: a.y, hasCamera: a.hasCamera }],
          4,
          DEPOT,
          0,
        ).stops[0];
        return { id: a.id, pct: Math.min(99, Math.round(p.p_block * 100)), load: one.load };
      });
  }, [idle, plan]);

  // Which crew holds each open stop, in run order, for the coloured rings and routes on the map.
  const crewRoutes: MapRoute[] = st.crews.flatMap((c, i) => {
    const r = st.runs[c.id];
    const ids = r && !hiddenCrews.includes(c.id) ? r.stops.filter((s) => !r.done.includes(s.id)).map((s) => s.id) : [];
    return ids.length ? [{ name: c.name, color: HATS[i % HATS.length], ids }] : [];
  });
  const stopCrew = new Map<string, { color: string; letter: string }>();
  st.crews.forEach((c, i) => {
    const r = hiddenCrews.includes(c.id) ? undefined : st.runs[c.id];
    r?.stops
      .filter((s) => !r.done.includes(s.id))
      .forEach((s) => stopCrew.set(s.id, { color: HATS[i % HATS.length], letter: crewLetter(c.name) }));
  });

  const mapAssets: MapAsset[] = rows.map(({ p, a, state }) => ({
    crewColor: stopCrew.get(a.id)?.color,
    crewLetter: stopCrew.get(a.id)?.letter,
    id: a.id,
    type: a.type,
    typeLabel: a.typeLabel,
    x: a.x,
    y: a.y,
    hasCamera: a.hasCamera,
    level: state === "done" ? "low" : p.level,
    state,
    planN: planN.get(a.id),
  }));

  const mapCrews: MapCrew[] = st.crews.map((c, i) => {
    const r = st.runs[c.id];
    const next = r && r.accepted && isBusy(r) ? r.stops.find((x) => !r.done.includes(x.id)) : undefined;
    const spot = next ? byId.get(next.id) : undefined;
    return {
      id: c.id,
      name: c.name,
      hat: HATS[i % HATS.length],
      letter: crewLetter(c.name),
      x: spot ? spot.x + 24 : 70 + (i - 1) * 22 + 22,
      y: spot ? spot.y + 26 : 475,
      working: !!spot,
    };
  });

  function stopFor(id: string, load: number, photosNeeded: boolean): RunStop {
    const r = rows.find((x) => x.a.id === id);
    return {
      id,
      load,
      photosNeeded,
      typeLabel: r?.a.typeLabel,
      pct: r ? Math.min(99, Math.round(r.p.p_block * 100)) : undefined,
      tier: r ? TIER[r.p.level] : undefined,
      why: r ? r.p.reasons.slice(0, 2).join(". ") + "." : undefined,
    };
  }

  function startRun(stops: RunStop[], target: { id: string; name: string }) {
    if (isBusy(st.runs[target.id])) {
      setToast(`${target.name} is busy. Pick another crew.`);
      return;
    }
    const total = stops.reduce((n, s) => n + s.load, 0);
    const t = fmtClock(simMinute());
    const msg =
      stops.length > 1
        ? `${target.name} sent on a run: ${stops.length} stops, ${total.toFixed(1)} of ${capacity.toFixed(1)} m³ (estimated).`
        : `${target.name} sent to ${stops[0].id}.`;
    // eslint-disable-next-line react-hooks/purity -- startRun only runs from click handlers, never during render
    const runId = `run-${Date.now()}`;
    save({
      ...st,
      runs: {
        ...st.runs,
        [target.id]: {
          runId,
          crew: target.id,
          stops,
          capacity,
          accepted: false,
          done: [],
        },
      },
      log: addLog(st.log, t, msg, { crewId: target.id, runId }),
    });
    setToast(msg);
    setCur(null);
  }

  // Take back a run that was sent by mistake. Stops already cleaned (and their records) stay; the rest return to the queue.
  function withdrawRun(crewId: string) {
    const r = st.runs[crewId];
    const crew = st.crews.find((c) => c.id === crewId);
    if (!r || !crew || !isBusy(r)) return;
    const left = r.stops.filter((s) => !r.done.includes(s.id));
    const kept = r.stops.filter((s) => r.done.includes(s.id));
    const msg = `${crew.name} withdrawn from ${left.map((s) => s.id).join(", ")}. Back in the queue.`;
    save({
      ...st,
      runs: { ...st.runs, [crewId]: kept.length ? { ...r, stops: kept } : undefined },
      log: addLog(st.log, fmtClock(simMinute()), msg, { crewId }),
    });
    setToast(msg);
  }

  function save(next: SavedState) {
    setSt(next);
    saveState(next);
  }

  function renameCrew(id: string, name: string) {
    save({ ...st, crews: st.crews.map((c) => (c.id === id ? { ...c, name } : c)) });
  }

  function addCrew() {
    if (st.crews.length >= MAX_CREWS) return;
    const used = new Set(st.crews.map((c) => c.name));
    let n = st.crews.length;
    let name = `Crew ${String.fromCharCode(65 + n)}`;
    while (used.has(name)) name = `Crew ${String.fromCharCode(65 + ++n)}`;
    // eslint-disable-next-line react-hooks/purity -- only called from a click handler
    save({ ...st, crews: [...st.crews, { id: `c${Date.now()}`, name }] });
  }

  function removeCrew(id: string) {
    if (st.crews.length <= 1 || isBusy(st.runs[id])) return;
    const runs = { ...st.runs };
    delete runs[id];
    save({ ...st, crews: st.crews.filter((c) => c.id !== id), runs });
  }

  function dispatchOne(id: string) {
    const p = plan.stops.find((s) => s.id === id);
    const a = byId.get(id)!;
    const r = rows.find((x) => x.a.id === id)!;
    // Single-stop run: use the planner on just this asset so the load estimate stays in one place.
    const one =
      p ??
      planRun([{ id, type: a.type, risk: r.p.p_block, x: a.x, y: a.y, hasCamera: a.hasCamera }], 4, DEPOT, 0).stops[0];
    setCur(null);
    setChoose([stopFor(id, one.load, one.photosNeeded)]);
  }

  const openAsset = (id: string) => {
    if (rows.find((r) => r.a.id === id)?.state === "idle") setCur(id);
  };

  const showMap = role === "manager" || role === "split";
  const showPhone = role === "split";
  const tabbed = showPhone; // Manager shows every panel at once; side-by-side keeps tabs to save room
  const high = idle.filter((r) => r.p.level === "high").length;
  const curRow = cur ? rows.find((r) => r.a.id === cur) : undefined;
  const planPct = Math.min(100, Math.round((plan.totalLoad / capacity) * 100));
  const forecastHour = Math.min(5, Math.floor(minute / 60));
  const photoRecs = records.filter((r) => r.method === "photos");

  const confirmCrew = confirm ? st.crews.find((c) => c.id === confirm.crewId) : undefined;
  const confirmRun = confirmCrew ? st.runs[confirmCrew.id] : undefined;
  const confirmView = (() => {
    if (!confirm || !confirmCrew) return null;
    const name = confirmCrew.name;
    const cleanedBy = records.filter((r) => r.crewId === name).length;
    if (confirm.kind === "withdraw") {
      const left = confirmRun ? confirmRun.stops.filter((x) => !confirmRun.done.includes(x.id)) : [];
      if (left.length === 0) return null;
      return (
        <ConfirmDialog
          label={`Withdraw ${name}`}
          eyebrow="Withdraw run"
          title={`Withdraw ${name}?`}
          confirmLabel="Withdraw run"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            withdrawRun(confirm.crewId);
            setConfirm(null);
          }}
        >
          <p style={{ margin: "0 0 10px" }}>
            {confirmRun?.accepted
              ? `${name} has accepted this run and may already be on the way.`
              : `${name} has been sent but has not accepted yet.`}
          </p>
          <p style={{ margin: "0 0 10px" }}>
            <b>Going back to the queue ({left.length}):</b> {left.map((x) => x.id).join(", ")}.
            {confirmRun && confirmRun.done.length > 0
              ? ` ${confirmRun.done.length} already cleaned stop(s) stay in the records.`
              : ""}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#8FB8CC" }}>
            The crew app will show &quot;Waiting for the next task&quot;. You can send the stops to any available crew
            afterwards.
          </p>
        </ConfirmDialog>
      );
    }
    return (
      <ConfirmDialog
        label={`Remove ${name}`}
        eyebrow="Remove crew"
        title={`Remove ${name}?`}
        confirmLabel="Remove crew"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          removeCrew(confirm.crewId);
          setConfirm(null);
        }}
      >
        <p style={{ margin: "0 0 10px" }}>
          {name} has no run right now, so no job is in progress.
          {cleanedBy > 0 ? ` They cleaned ${cleanedBy} job(s) today.` : " They have not cleaned any job today."}
        </p>
        <p style={{ margin: 0, fontSize: 14, color: "#8FB8CC" }}>
          Their records stay in Compliance records. The crew disappears from the crew list, the map and the &quot;Who
          should go?&quot; list. You can add a new crew later, but not bring this one back.
        </p>
      </ConfirmDialog>
    );
  })();

  const panelProps = (id: PanelTab, label: string) =>
    tabbed
      ? ({ role: "tabpanel", id: `fr-panel-${id}`, "aria-labelledby": `fr-tab-${id}`, hidden: tab !== id } as const)
      : ({
          role: "region",
          id: `fr-panel-${id}`,
          "aria-label": label,
          tabIndex: id === "queue" ? -1 : undefined,
        } as const);

  const recordsPanel = (
    <section className="fr-section" {...panelProps("records", "Records")}>
      <div className="fr-label">Compliance records</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Stat n={photoRecs.filter((r) => r.before).length} color="#FFD27A" l1="Before photos" l2="AI training" />
        <Stat n={photoRecs.filter((r) => r.after).length} color="#7ED9A3" l1="After photos" l2="evidence" />
        <Stat n={records.filter((r) => r.method === "camera").length} color="#4FC3E8" l1="Camera" l2="checks" />
      </div>
      {records.length === 0 ? (
        <div style={{ marginTop: 12, fontSize: 14, color: "#8FB8CC", lineHeight: 1.4 }}>
          No completed jobs yet. Sites with a camera are checked by the camera. All other sites need a before and an
          after photo before the job can be closed.
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: "12px 0 0",
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {[...records]
            .reverse()
            .slice(0, 3)
            .map((e) => (
              <li
                key={e.stopId + e.at}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  background: "#0B2233",
                  borderRadius: 12,
                  padding: "8px 10px",
                }}
              >
                {e.method === "camera" ? <CameraIcon w={48} /> : <PhotoPair />}
                <div style={{ fontSize: 13, lineHeight: 1.35, color: "#CFE6F0" }}>
                  <b>{e.stopId}</b> · {e.method === "camera" ? "checked by camera" : "verified by photos"}
                  <br />
                  {e.crewId} · {e.clock}
                  {e.pct != null ? ` · risk was ${e.pct}%` : ""}
                </div>
              </li>
            ))}
        </ul>
      )}
      {records.length > 3 && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#B9D6E3" }}>
          Showing the latest 3 of {records.length} records.
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: "#8FB8CC", lineHeight: 1.4 }}>
        Sample records, metadata only. Photos are not stored by the manager screen. Real photos would carry time and
        location, be stored with the work order, and be checked for faces and number plates before use in training.
      </div>
    </section>
  );

  const crewsPanel = (
    <section className="fr-section" {...panelProps("crews", "Crews")}>
      <div className="fr-label">Crews · rename, add or remove</div>
      <ul
        style={{
          listStyle: "none",
          margin: "10px 0 10px",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {st.crews.map((c, i) => {
          const r = st.runs[c.id];
          const status = !isBusy(r) ? "Ready" : r?.accepted ? "Cleaning" : "Dispatched";
          return (
            <li
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#0B2233",
                borderRadius: 12,
                padding: "6px 10px",
              }}
            >
              <span
                aria-hidden="true"
                style={{ width: 14, height: 14, borderRadius: 999, background: HATS[i % HATS.length], flex: "none" }}
              />
              <input
                aria-label={`Name of crew ${i + 1}`}
                value={c.name}
                maxLength={24}
                onChange={(e) => renameCrew(c.id, e.target.value)}
                onBlur={(e) => {
                  if (!e.target.value.trim()) renameCrew(c.id, `Crew ${String.fromCharCode(65 + i)}`);
                }}
                style={{
                  flex: 1,
                  minWidth: 0,
                  minHeight: 40,
                  background: "transparent",
                  color: "#EAF6FB",
                  border: "1px solid #2D6182",
                  borderRadius: 8,
                  padding: "4px 8px",
                  fontSize: 15,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              />
              <span style={{ color: status === "Ready" ? "#8FB8CC" : "#FFD27A", fontWeight: 600, fontSize: 14 }}>
                {status}
              </span>
              {isBusy(r) ? (
                <button
                  type="button"
                  className="fr-btn fr-sec"
                  aria-label={`Withdraw ${c.name} from the run`}
                  title="Take this run back. Stops not yet cleaned return to the queue."
                  onClick={() => setConfirm({ kind: "withdraw", crewId: c.id })}
                  style={{ padding: "4px 10px", minHeight: 40, fontSize: 14 }}
                >
                  Withdraw
                </button>
              ) : (
                <button
                  type="button"
                  className="fr-btn fr-ghost"
                  aria-label={`Remove ${c.name}`}
                  disabled={st.crews.length <= 1}
                  title="Remove crew"
                  onClick={() => setConfirm({ kind: "remove", crewId: c.id })}
                  style={{ padding: "4px 10px", minHeight: 40, fontSize: 14 }}
                >
                  Remove
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="fr-btn fr-sec"
        disabled={st.crews.length >= MAX_CREWS}
        onClick={addCrew}
        style={{ padding: "6px 16px", minHeight: 40, fontSize: 14, marginBottom: 18 }}
      >
        Add crew
      </button>
    </section>
  );

  const logRows = [...st.log, { t: "13:00", x: "Shift started. Risk scores update with leaf fall and rain." }];
  const logPanel = (
    <section className="fr-section" hidden={tabbed && tab !== "crews"} aria-label="Activity log">
      <div className="fr-label">Activity log</div>
      <ol
        style={{
          listStyle: "none",
          margin: "10px 0 0",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          fontSize: 15,
          lineHeight: 1.4,
          maxHeight: logOpen ? 420 : undefined,
          overflowY: logOpen ? "auto" : undefined,
        }}
        tabIndex={logOpen ? 0 : undefined}
        aria-label="Activity log entries"
      >
        {logRows.slice(0, logOpen ? undefined : LOG_PREVIEW).map((l, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#0B2233",
              borderRadius: 12,
              padding: "10px 14px",
            }}
          >
            {(() => {
              const ci = st.crews.findIndex((c) => c.id === l.crewId);
              return (
                <span
                  aria-hidden="true"
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    flex: "none",
                    background: ci >= 0 ? HATS[ci % HATS.length] : "transparent",
                    border: ci >= 0 ? "2px solid #0B2233" : "2px dashed #2D6182",
                    boxShadow: ci >= 0 ? "0 0 0 1px #EAF6FB" : undefined,
                  }}
                />
              );
            })()}
            <span style={{ flex: 1, minWidth: 0 }}>
              <b style={{ color: "#8FB8CC" }}>{l.t}</b> &nbsp;{l.x}
            </span>
          </li>
        ))}
      </ol>
      {logRows.length > LOG_PREVIEW && (
        <button
          type="button"
          className="fr-btn fr-sec"
          aria-expanded={logOpen}
          onClick={() => setLogOpen((o) => !o)}
          style={{ marginTop: 10, padding: "6px 16px", minHeight: 40, fontSize: 14 }}
        >
          {logOpen ? "Show less" : `Show today's full log (${logRows.length})`}
        </button>
      )}
      <button
        type="button"
        className="fr-btn fr-ghost"
        style={{ marginTop: 8, padding: "6px 0", minHeight: 40, fontSize: 14 }}
        onClick={() => {
          resetAll();
          setCur(null);
        }}
      >
        Reset sample session
      </button>
    </section>
  );

  return (
    <div style={{ minHeight: 900, position: "relative", background: "#0B2233", color: "#EAF6FB" }}>
      {role === "manager" || role === "split" ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "14px 28px",
            background: "#102F45",
            borderBottom: "2px solid #1E4A63",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <svg width="34" height="34" viewBox="0 0 36 36" aria-hidden="true">
              <path d="M18 3 C18 3 6 15 6 22 a12 12 0 0 0 24 0 C30 15 18 3 18 3Z" fill="#4FC3E8" />
              <path d="M18 15 C18 15 12.5 20 12.5 24 a5.5 5.5 0 0 0 11 0 C23.5 20 18 15 18 15Z" fill="#FF8A4C" />
            </svg>
            <span style={{ fontWeight: 700, fontSize: 22 }}>DrainWise</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#B9D6E3",
                border: "1px solid #2D6182",
                borderRadius: 999,
                padding: "4px 12px",
              }}
            >
              Simulation · sample data
            </span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
            <div className="fr-tile">
              <div>TIME</div>
              <div>{fmtClock(minute)}</div>
            </div>
            <div className="fr-tile">
              <div>RAIN NOW</div>
              <div>{Math.round(rainNow(minute))} mm/h</div>
            </div>
            <div className="fr-tile">
              <div>HIGH RISK</div>
              <div>
                {high} of {seed.length}
              </div>
            </div>
            <div className="fr-tile">
              <div>CLEANED TODAY</div>
              <div>{records.length}</div>
            </div>
            <button
              className="fr-btn fr-sec"
              type="button"
              onClick={() => {
                setRole(null);
                setCur(null);
              }}
              style={{ padding: "8px 16px", minHeight: 44 }}
            >
              Switch role
            </button>
          </div>
        </div>
      ) : null}

      {showMap && (
        <div className={`fr-shell${showPhone ? " fr-split" : " fr-dash"}`}>
          <section className="fr-mapcol">
            <a
              className="fr-skip"
              href="#fr-panel-queue"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(tabbed ? `fr-tab-${tab}` : "fr-panel-queue")?.focus();
              }}
            >
              Skip map, go to panels
            </a>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  zIndex: 5,
                  display: "flex",
                  gap: 6,
                  background: "#102F45",
                  border: "2px solid #2D6182",
                  borderRadius: 999,
                  padding: 4,
                }}
              >
                <button
                  type="button"
                  className={`fr-btn ${view === "2d" ? "fr-pri" : "fr-sec"}`}
                  aria-pressed={view === "2d"}
                  onClick={() => setView("2d")}
                  style={{ padding: "6px 16px", minHeight: 40 }}
                >
                  2D map
                </button>
                <button
                  type="button"
                  className={`fr-btn ${view === "3d" ? "fr-pri" : "fr-sec"}`}
                  aria-pressed={view === "3d"}
                  onClick={() => setView("3d")}
                  style={{ padding: "6px 16px", minHeight: 40 }}
                >
                  3D water
                </button>
              </div>
              {error && (
                <p
                  role="alert"
                  style={{
                    margin: "0 0 12px",
                    background: "#3A1A12",
                    border: "2px solid #FF8A4C",
                    borderRadius: 14,
                    padding: "10px 14px",
                    fontSize: 14,
                  }}
                >
                  Could not get risk scores: {error}. Start the risk API with <code>uvicorn risk_api.main:app</code>{" "}
                  from the project root.
                </p>
              )}
              {view === "3d" ? (
                <Map3D assets={mapAssets} crews={mapCrews} rainMmH={rainNow(minute)} extra={extra} onOpen={openAsset} />
              ) : (
                <MapView
                  assets={mapAssets}
                  route={plan.stops.map((s) => s.id)}
                  routes={crewRoutes}
                  crews={mapCrews}
                  hiddenCrews={hiddenCrews}
                  onToggleCrew={(id) =>
                    setHiddenCrews((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))
                  }
                  onOpen={openAsset}
                />
              )}
              <div role="status" className="fr-sr">
                {toast}
              </div>
              {toast && (
                <div
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 20,
                    top: 14,
                    maxWidth: "55%",
                    background: "#102F45",
                    border: "2px solid #4FC3E8",
                    borderRadius: 14,
                    padding: "10px 16px",
                    fontWeight: 600,
                    fontSize: 15,
                    zIndex: 6,
                  }}
                >
                  {toast}
                </div>
              )}
            </div>
            {!tabbed && (
              <div className="fr-below">
                {crewsPanel}
                {logPanel}
                {recordsPanel}
              </div>
            )}
          </section>

          <aside className="fr-side" aria-label="Manager panels">
            {tabbed && (
              <div
                role="tablist"
                aria-label="Manager tabs"
                className="fr-tabs"
                onKeyDown={(e) => {
                  const n = TABS.length;
                  const i = TABS.findIndex((x) => x.id === tab);
                  const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
                  let next = -1;
                  if (step) next = (i + step + n) % n;
                  else if (e.key === "Home") next = 0;
                  else if (e.key === "End") next = n - 1;
                  if (next < 0) return;
                  e.preventDefault();
                  setTab(TABS[next].id);
                  document.getElementById(`fr-tab-${TABS[next].id}`)?.focus();
                }}
              >
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`fr-tab-${t.id}`}
                    aria-selected={tab === t.id}
                    aria-controls={`fr-panel-${t.id}`}
                    tabIndex={tab === t.id ? 0 : -1}
                    className={`fr-tab${tab === t.id ? " fr-tab-on" : ""}`}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                    {t.id === "plan" && plan.stops.length > 0 ? ` · ${plan.stops.length}` : ""}
                  </button>
                ))}
              </div>
            )}
            <section className="fr-section" {...panelProps("queue", "Check next")}>
              <div className="fr-label">Check next · highest blockage risk</div>
              <ol
                style={{
                  listStyle: "none",
                  margin: "12px 0 0",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {idle.slice(0, 5).map(({ p, a }) => (
                  <li
                    key={a.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "#0B2233",
                      borderRadius: 14,
                      padding: "10px 12px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>
                        {a.id}{" "}
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            borderRadius: 999,
                            padding: "2px 8px",
                            marginLeft: 4,
                            ...TIER_STYLE[p.level],
                          }}
                        >
                          {TIER[p.level]} · {Math.min(99, Math.round(p.p_block * 100))}%
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#B9D6E3", lineHeight: 1.35 }}>
                        {p.reasons.slice(0, 2).join(" · ")}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="fr-btn fr-pri"
                      style={{ padding: "6px 14px", minHeight: 40, fontSize: 14 }}
                      onClick={() => dispatchOne(a.id)}
                      disabled={busy}
                      aria-label={`Send crew to ${a.id}`}
                    >
                      Send crew
                    </button>
                  </li>
                ))}
              </ol>
            </section>

            <section className="fr-section" {...panelProps("plan", "Run plan")}>
              <div className="fr-label">Truck run planner</div>
              <label
                htmlFor="fr-cap"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 15,
                  fontWeight: 600,
                  marginTop: 12,
                }}
              >
                <span>Truck capacity</span>
                <span style={{ color: "#CFE6F0" }}>{capacity.toFixed(1)} m³ (assumption)</span>
              </label>
              <input
                id="fr-cap"
                type="range"
                min={1}
                max={4}
                step={0.5}
                value={capacity}
                onChange={(e) => setCapacity(+e.target.value)}
                style={{ width: "100%", accentColor: "#4FC3E8" }}
              />
              {plan.stops.length === 0 ? (
                <div style={{ marginTop: 10, fontSize: 14, color: "#8FB8CC" }}>No stops worth a run right now.</div>
              ) : (
                <>
                  <div style={{ marginTop: 12, fontWeight: 700, fontSize: 16 }}>
                    Best run now: {plan.totalLoad.toFixed(1)} of {capacity.toFixed(1)} m³ · {plan.stops.length} stops
                  </div>
                  <div style={{ height: 10, background: "#1E4A63", borderRadius: 999, margin: "8px 0 12px" }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: 999,
                        background: planPct >= 85 ? "#FF8A4C" : "#4FC3E8",
                        width: `${planPct}%`,
                      }}
                    />
                  </div>
                  <ol
                    tabIndex={0}
                    aria-label="Planned stops"
                    style={{
                      listStyle: "none",
                      margin: "0 0 12px",
                      padding: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      maxHeight: 220,
                      overflowY: "auto",
                    }}
                  >
                    {plan.stops.map((s, i) => {
                      const r = rows.find((x) => x.a.id === s.id);
                      return (
                        <li
                          key={s.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            background: "#0B2233",
                            borderRadius: 12,
                            padding: "8px 12px",
                            fontSize: 14,
                          }}
                        >
                          <span>
                            <b>
                              {i + 1}. {s.id}
                            </b>{" "}
                            · {r ? TIER[r.p.level] : ""}
                            <br />
                            <span style={{ color: "#8FB8CC", fontSize: 12 }}>
                              {s.photosNeeded ? "photos needed" : "camera, no photos"}
                            </span>
                          </span>
                          <span style={{ fontWeight: 700, color: "#FFD27A", whiteSpace: "nowrap" }}>
                            {s.load.toFixed(2)} m³
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                  <button
                    className="fr-btn fr-pri"
                    type="button"
                    style={{ width: "100%" }}
                    onClick={() => setChoose(plan.stops.map((s) => stopFor(s.id, s.load, s.photosNeeded)))}
                    disabled={busy}
                  >
                    {busy ? "All crews are busy" : "Send a crew on this run"}
                  </button>
                  {busy && (
                    <div style={{ marginTop: 8, fontSize: 13, color: "#8FB8CC" }}>
                      This is the next possible run. It can be sent when a crew is back at the depot.
                    </div>
                  )}
                </>
              )}
              {leftOut.length > 0 && (
                <div style={{ marginTop: 10, fontSize: 13, color: "#B9D6E3", lineHeight: 1.4 }}>
                  Not in this run: {leftOut.map((o) => `${o.id} (${o.pct}%, about ${o.load.toFixed(1)} m³)`).join(", ")}
                  . The run picks the set with the most total risk that fits the truck, so a large asset can lose to
                  several small ones. Send it on its own from Check next.
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 12, color: "#8FB8CC", lineHeight: 1.4 }}>
                Only Medium and High risk assets (30% or more) are considered. Stops maximise total risk within
                capacity, then are ordered nearest-first from the depot. Load sizes are sample estimates. Real truck and
                bin volumes come from council.
              </div>
            </section>

            {tabbed && recordsPanel}
            {tabbed && crewsPanel}
            {tabbed && logPanel}

            <details className="fr-sim" key={tabbed ? "tabbed" : "dash"} open={!tabbed}>
              <summary>Simulation controls · What if and rain forecast (sample data)</summary>
              <section className="fr-group">
                <div className="fr-label">What if · demo controls</div>
                <label
                  htmlFor="fr-leaf"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 15,
                    fontWeight: 600,
                    marginTop: 12,
                  }}
                >
                  <span>Leaf fall</span>
                  <span style={{ color: "#CFE6F0" }}>
                    {leaf < 25 ? `Low (${leaf}%)` : leaf < 65 ? `Moderate (${leaf}%)` : `Peak (${leaf}%)`}
                  </span>
                </label>
                <input
                  id="fr-leaf"
                  type="range"
                  min={0}
                  max={100}
                  value={leaf}
                  onChange={(e) => setLeaf(+e.target.value)}
                  style={{ width: "100%", accentColor: "#FFD27A" }}
                />
                <label
                  htmlFor="fr-extra"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 15,
                    fontWeight: 600,
                    marginTop: 8,
                  }}
                >
                  <span>Extra rain</span>
                  <span style={{ color: "#CFE6F0" }}>
                    {extra === 0 ? "Forecast as is" : `+${extra}%`} · {rainForecast} mm
                  </span>
                </label>
                <input
                  id="fr-extra"
                  type="range"
                  min={0}
                  max={100}
                  value={extra}
                  onChange={(e) => setExtra(+e.target.value)}
                  style={{ width: "100%", accentColor: "#FF8A4C" }}
                />
                <div style={{ marginTop: 10, fontSize: 13, color: "#8FB8CC", lineHeight: 1.4 }}>
                  Risk scores come from a gradient boosting model trained on simulated history, not on real council
                  records. Every score shows its reasons.
                </div>
              </section>

              <section className="fr-group">
                <div className="fr-label">Rain forecast · next 6 hours</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90, marginTop: 26 }}>
                  {FORECAST.map((v, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        borderRadius: "8px 8px 3px 3px",
                        position: "relative",
                        background: v >= 20 ? "#FF8A4C" : "#4FC3E8",
                        height: `${Math.round((v / 31) * 100)}%`,
                        outline: i === forecastHour ? "2px solid #EAF6FB" : undefined,
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: -20,
                          left: 0,
                          right: 0,
                          textAlign: "center",
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#CFE6F0",
                        }}
                      >
                        {v}
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, fontSize: 13, fontWeight: 600, color: "#8FB8CC" }}>
                  {[13, 14, 15, 16, 17, 18].map((h) => (
                    <span key={h} style={{ flex: 1 }}>
                      {h}
                    </span>
                  ))}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: "#8FB8CC" }}>
                  Sample forecast (mm/h). Not a Bureau of Meteorology feed yet.
                </div>
              </section>
            </details>
          </aside>

          {showPhone && (
            <div className="fr-phonecol">
              <CrewApp onSwitchRole={() => setRole(null)} />
            </div>
          )}
        </div>
      )}

      {curRow && showMap && (
        <Dialog
          label={`${curRow.a.id} details`}
          eyebrow={curRow.a.typeLabel}
          title={`${curRow.a.id} · ${TIER[curRow.p.level]} risk`}
          maxWidth={540}
          onClose={() => setCur(null)}
          actions={
            <>
              <button className="fr-btn fr-pri" type="button" onClick={() => dispatchOne(curRow.a.id)} disabled={busy}>
                {busy ? "All crews are busy" : "Send a crew to clean it"}
              </button>
              <button className="fr-btn fr-ghost" type="button" onClick={() => setCur(null)}>
                Not now
              </button>
            </>
          }
        >
          <p style={{ margin: "0 0 12px" }}>
            Estimated blockage risk about {Math.min(99, Math.round(curRow.p.p_block * 100))}%.{" "}
            {curRow.a.hasCamera
              ? `Camera view: about ${Math.min(99, Math.round(curRow.p.p_block * 90))}% full (sample).`
              : "No camera here, so this is a model estimate."}
          </p>
          <ul style={{ margin: "0 0 12px", paddingLeft: 20 }}>
            {curRow.p.reasons.slice(0, 3).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div style={{ fontSize: 14, color: "#8FB8CC" }}>
            Sample data. The crew confirms the real condition on site.
          </div>
        </Dialog>
      )}

      {choose && showMap && (
        <CrewChooser
          crews={st.crews}
          runs={st.runs}
          count={choose.length}
          onCancel={() => setChoose(null)}
          onPick={(id) => {
            const c = st.crews.find((x) => x.id === id);
            if (c) startRun(choose, c);
            setChoose(null);
          }}
        />
      )}

      {confirm && showMap && confirmView}

      {role === null && (
        <RoleScreen
          onManager={() => setRole("manager")}
          onSplit={() => setRole("split")}
          onCrew={() => router.push("/crew")}
        />
      )}
    </div>
  );
}

function Stat({ n, color, l1, l2 }: { n: number; color: string; l1: string; l2: string }) {
  return (
    <div style={{ flex: 1, background: "#0B2233", borderRadius: 14, padding: 10 }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{n}</div>
      <div style={{ fontSize: 12, lineHeight: 1.3, color: "#CFE6F0" }}>
        {l1}
        <br />
        {l2}
      </div>
    </div>
  );
}

// Illustration only: the manager screen never holds the real photos.
function PhotoPair() {
  return (
    <svg
      width="48"
      height="32"
      viewBox="0 0 120 80"
      role="img"
      aria-label="Photos recorded (illustration)"
      style={{ flex: "none", borderRadius: 10 }}
    >
      <rect width="120" height="80" rx="10" fill="#3A4A3A" />
      <rect x="14" y="18" width="92" height="44" rx="8" fill="#0B1626" />
      <path d="M32 24v32M50 24v32M68 24v32M86 24v32" stroke="#4A5F94" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

// Pick which crew takes the run. Every crew is listed A to Z with its map colour; busy ones are disabled.
function CrewChooser({
  crews,
  runs,
  count,
  onPick,
  onCancel,
}: {
  crews: SavedState["crews"];
  runs: SavedState["runs"];
  count: number;
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const list = crews
    .map((c, i) => ({ c, color: HATS[i % HATS.length], isBusy: isBusy(runs[c.id]) }))
    .sort((m, n) => m.c.name.localeCompare(n.c.name, undefined, { sensitivity: "base", numeric: true }));
  const firstFree = list.findIndex((x) => !x.isBusy);
  return (
    <Dialog
      label="Choose a crew"
      eyebrow="Send a crew"
      title="Who should go?"
      onClose={onCancel}
      actions={
        <button className="fr-btn fr-ghost" type="button" onClick={onCancel}>
          Cancel
        </button>
      }
    >
      <p style={{ margin: "0 0 14px", fontSize: 14, color: "#B9D6E3" }}>
        {count > 1 ? `A run of ${count} stops.` : "One stop."} Crews already out on a run can&apos;t take it.
      </p>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {list.map(({ c, color, isBusy: out }, i) => (
          <li key={c.id}>
            <button
              type="button"
              className="fr-btn"
              autoFocus={i === firstFree}
              disabled={out}
              onClick={() => onPick(c.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: "flex-start",
                minHeight: 48,
                background: "#1E4A63",
                color: "#EAF6FB",
                opacity: out ? 0.55 : 1,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 999,
                  background: color,
                  border: "2px solid #0B2233",
                  boxShadow: "0 0 0 1px #EAF6FB",
                  flex: "none",
                }}
              />
              <span style={{ flex: 1, textAlign: "left" }}>{c.name}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: out ? "#FFD27A" : "#8FB8CC" }}>
                {out ? "Out on a run" : "Available"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
