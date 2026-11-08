"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { planRun, type Asset } from "../../planner/src/planRun";
import { DEPOT, makeSeedAssets } from "@/lib/seed";
import {
  FORECAST,
  addLog,
  fmtClock,
  isBusy,
  loadRun,
  rainNow,
  resetAll,
  saveRun,
  simMinute,
  subscribeRun,
  type RunStop,
  type SavedRun,
} from "@/lib/runStore";
import MapView, { type Level, type MapAsset, type MapCrew } from "./MapView";
import RoleScreen from "./RoleScreen";
import dynamic from "next/dynamic";

// three.js is only loaded when the 3D view is opened.
const Map3D = dynamic(() => import("./Map3D"), {
  ssr: false,
  loading: () => <p style={{ padding: 16 }}>Loading 3D view…</p>,
});
import CrewApp, { CameraIcon } from "./CrewApp";

type Prediction = { asset_id: string; p_block: number; level: Level; reasons: string[] };
type Role = null | "manager" | "split";
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
const CREWS = [
  { name: "Crew A", letter: "A", hat: "#FFD27A" },
  { name: "Crew B", letter: "B", hat: "#FF8A4C" },
  { name: "Crew C", letter: "C", hat: "#7ED9A3" },
];

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
  const [run, setRun] = useState<SavedRun | null>(null);
  const [cur, setCur] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [minute, setMinute] = useState(0);
  const [view, setView] = useState<"2d" | "3d">("2d");

  useEffect(() => {
    const read = () => setRun(loadRun());
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

  const records = useMemo(() => run?.records ?? [], [run]);
  const cleaned = useMemo(() => new Set(records.map((r) => r.stopId)), [records]);
  const assigned = useMemo(
    () => new Set(run ? run.stops.filter((s) => !run.done.includes(s.id)).map((s) => s.id) : []),
    [run],
  );

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
      (preds ?? []).map((p) => {
        const a = byId.get(p.asset_id)!;
        const state: MapAsset["state"] = cleaned.has(a.id) ? "done" : assigned.has(a.id) ? "busy" : "idle";
        return { p, a, state };
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
  const busy = isBusy(run);
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

  const mapAssets: MapAsset[] = rows.map(({ p, a, state }) => ({
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

  const accepted = !!run?.accepted && isBusy(run);
  const current = run && isBusy(run) ? run.stops.find((s) => !run.done.includes(s.id)) : undefined;
  const cur1 = current ? byId.get(current.id) : undefined;
  const mapCrews: MapCrew[] = CREWS.map((c, i) => {
    const away = c.name === "Crew A" && accepted && cur1;
    return {
      name: c.name,
      hat: c.hat,
      letter: c.letter,
      x: away ? cur1!.x + 24 : 70 + (i - 1) * 22 + 22,
      y: away ? cur1!.y + 26 : 475,
      working: !!away,
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

  function startRun(stops: RunStop[]) {
    if (isBusy(run)) {
      setToast("All crews are busy. Try again soon.");
      return;
    }
    const total = stops.reduce((n, s) => n + s.load, 0);
    const t = fmtClock(simMinute());
    const msg =
      stops.length > 1
        ? `Crew A sent on a run: ${stops.length} stops, ${total.toFixed(1)} of ${capacity.toFixed(1)} m³ (estimated).`
        : `Crew A sent to ${stops[0].id}.`;
    saveRun({
      // eslint-disable-next-line react-hooks/purity -- startRun only runs from click handlers, never during render
      runId: `run-${Date.now()}`,
      crew: "Crew A",
      stops,
      capacity,
      accepted: false,
      done: [],
      records: run?.records ?? [],
      log: addLog(run?.log, t, msg),
    });
    setToast(msg);
    setCur(null);
  }

  function dispatchOne(id: string) {
    const p = plan.stops.find((s) => s.id === id);
    const a = byId.get(id)!;
    const r = rows.find((x) => x.a.id === id)!;
    // Single-stop run: use the planner on just this asset so the load estimate stays in one place.
    const one =
      p ??
      planRun([{ id, type: a.type, risk: r.p.p_block, x: a.x, y: a.y, hasCamera: a.hasCamera }], 4, DEPOT, 0).stops[0];
    startRun([stopFor(id, one.load, one.photosNeeded)]);
  }

  const openAsset = (id: string) => {
    if (rows.find((r) => r.a.id === id)?.state === "idle") setCur(id);
  };

  const showMap = role === "manager" || role === "split";
  const showPhone = role === "split";
  const high = idle.filter((r) => r.p.level === "high").length;
  const curRow = cur ? rows.find((r) => r.a.id === cur) : undefined;
  const planPct = Math.min(100, Math.round((plan.totalLoad / capacity) * 100));
  const forecastHour = Math.min(5, Math.floor(minute / 60));
  const photoRecs = records.filter((r) => r.method === "photos");

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
        <div className={`fr-shell${showPhone ? " fr-split" : ""}`}>
          <section className="fr-mapcol">
            <a
              className="fr-skip"
              href="#fr-tab-queue"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`fr-tab-${tab}`)?.focus();
              }}
            >
              Skip map, go to panels
            </a>
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
                Could not get risk scores: {error}. Start the risk API with <code>uvicorn risk_api.main:app</code> from
                the project root.
              </p>
            )}
            {view === "3d" ? (
              <Map3D assets={mapAssets} crews={mapCrews} rainMmH={rainNow(minute)} extra={extra} onOpen={openAsset} />
            ) : (
              <MapView assets={mapAssets} route={plan.stops.map((s) => s.id)} crews={mapCrews} onOpen={openAsset} />
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
                  bottom: 70,
                  maxWidth: "70%",
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
          </section>

          <aside className="fr-side" aria-label="Manager panels">
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
            <section
              className="fr-section"
              role="tabpanel"
              id="fr-panel-queue"
              aria-labelledby="fr-tab-queue"
              hidden={tab !== "queue"}
            >
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

            <section
              className="fr-section"
              role="tabpanel"
              id="fr-panel-plan"
              aria-labelledby="fr-tab-plan"
              hidden={tab !== "plan"}
            >
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
                    onClick={() => startRun(plan.stops.map((s) => stopFor(s.id, s.load, s.photosNeeded)))}
                    disabled={busy}
                  >
                    {busy ? "Crew A is on a run" : "Send a crew on this run"}
                  </button>
                  {busy && (
                    <div style={{ marginTop: 8, fontSize: 13, color: "#8FB8CC" }}>
                      This is the next possible run. It can be sent when Crew A is back at the depot.
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

            <section
              className="fr-section"
              role="tabpanel"
              id="fr-panel-records"
              aria-labelledby="fr-tab-records"
              hidden={tab !== "records"}
            >
              <div className="fr-label">Compliance records</div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Stat
                  n={photoRecs.filter((r) => r.before).length}
                  color="#FFD27A"
                  l1="Before photos"
                  l2="AI training"
                />
                <Stat n={photoRecs.filter((r) => r.after).length} color="#7ED9A3" l1="After photos" l2="evidence" />
                <Stat n={records.filter((r) => r.method === "camera").length} color="#4FC3E8" l1="Camera" l2="checks" />
              </div>
              {records.length === 0 ? (
                <div style={{ marginTop: 12, fontSize: 14, color: "#8FB8CC", lineHeight: 1.4 }}>
                  No completed jobs yet. Sites with a camera are checked by the camera. All other sites need a before
                  and an after photo before the job can be closed.
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
                Sample records, metadata only. Photos are not stored by the manager screen. Real photos would carry time
                and location, be stored with the work order, and be checked for faces and number plates before use in
                training.
              </div>
            </section>

            <section
              className="fr-section"
              role="tabpanel"
              id="fr-panel-crews"
              aria-labelledby="fr-tab-crews"
              hidden={tab !== "crews"}
            >
              <div className="fr-label">Crews</div>
              <ul
                style={{
                  listStyle: "none",
                  margin: "10px 0 18px",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {CREWS.map((c) => {
                  const status =
                    c.name !== "Crew A" ? "Ready" : !isBusy(run) ? "Ready" : run?.accepted ? "Cleaning" : "Dispatched";
                  return (
                    <li
                      key={c.name}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        background: "#0B2233",
                        borderRadius: 12,
                        padding: "10px 14px",
                        fontWeight: 600,
                      }}
                    >
                      <span>{c.name}</span>
                      <span style={{ color: status === "Ready" ? "#8FB8CC" : "#FFD27A" }}>{status}</span>
                    </li>
                  );
                })}
              </ul>
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
                }}
              >
                {[...(run?.log ?? []), { t: "13:00", x: "Shift started. Risk scores update with leaf fall and rain." }]
                  .slice(0, 8)
                  .map((l, i) => (
                    <li key={i} style={{ background: "#0B2233", borderRadius: 12, padding: "10px 14px" }}>
                      <b style={{ color: "#8FB8CC" }}>{l.t}</b> &nbsp;{l.x}
                    </li>
                  ))}
              </ol>
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

            <details className="fr-sim">
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
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${curRow.a.id} details`}
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(5,15,25,.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 10,
          }}
        >
          <div
            className="fr-pop"
            style={{
              background: "#102F45",
              border: "3px solid #FF8A4C",
              borderRadius: 24,
              padding: 28,
              maxWidth: 540,
              width: "100%",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", color: "#FFB38A" }}>
              {curRow.a.typeLabel.toUpperCase()}
            </div>
            <h2 style={{ margin: "6px 0 8px", fontSize: 26, fontWeight: 700 }}>
              {curRow.a.id} · {TIER[curRow.p.level]} risk
            </h2>
            <p style={{ margin: "0 0 12px", fontSize: 16, lineHeight: 1.5, color: "#CFE6F0" }}>
              Estimated blockage risk about {Math.min(99, Math.round(curRow.p.p_block * 100))}%.{" "}
              {curRow.a.hasCamera
                ? `Camera view: about ${Math.min(99, Math.round(curRow.p.p_block * 90))}% full (sample).`
                : "No camera here, so this is a model estimate."}
            </p>
            <ul style={{ margin: "0 0 14px", paddingLeft: 20, fontSize: 15, lineHeight: 1.5, color: "#CFE6F0" }}>
              {curRow.p.reasons.slice(0, 3).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div style={{ fontSize: 14, color: "#8FB8CC", marginBottom: 18 }}>
              Sample data. The crew confirms the real condition on site.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <button className="fr-btn fr-pri" type="button" onClick={() => dispatchOne(curRow.a.id)}>
                Send a crew to clean it
              </button>
              <button className="fr-btn fr-ghost" type="button" onClick={() => setCur(null)}>
                Not now
              </button>
            </div>
          </div>
        </div>
      )}

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
