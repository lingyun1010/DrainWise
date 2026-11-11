"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { planRun, type Asset } from "../../planner/src/planRun";
import { DAYS, DAY_RAIN_MM, horizonInputs } from "../../planner/src/horizon";
import { dayRainMm, sydneyDate, type BomDay } from "../../planner/src/bomPrecis";
import { rainBlocks, unitFor } from "../../planner/src/rainBlocks";
import RainChart from "./RainChart";
import Tip from "./Tip";
import { resolveScores, type LiveResult } from "../../planner/src/resolveScores";
import { predict as predictLocal, type ModelJson } from "../../planner/src/riskModel";
import riskModel from "@/lib/riskModel.json";
import precomputed from "@/lib/precomputedScores.json";
import CrewToggles from "./CrewToggles";
import { lastReturn, openStops, reasonLabel, recentReturners, type Returned } from "../../planner/src/runActions";
import { DEPOT, makeSeedAssets } from "@/lib/seed";
import {
  DEFAULT_CREWS,
  HATS,
  addLog,
  crewLetter,
  sydneyClock,
  isBusy,
  loadState,
  openStopIds,
  resetAll,
  saveState,
  subscribeRun,
  type RunStop,
  type SavedState,
} from "@/lib/runStore";
import MapView, { type Level, type MapAsset, type MapCrew, type MapRoute } from "./MapView";
import RoleScreen from "./RoleScreen";
import Link from "next/link";
import RoomChip from "./RoomChip";
import ReviewBell, { RecordsBadge } from "./ReviewBell";
import CameraView from "./CameraView";
import Dialog, { ConfirmDialog } from "./Dialog";
import HowItWorks from "./HowItWorks";
import dynamic from "next/dynamic";

// three.js is only loaded when the 3D view is opened.
const Map3D = dynamic(() => import("./Map3D"), {
  ssr: false,
  loading: () => <p style={{ padding: 16 }}>Loading 3D view…</p>,
});
import Image from "next/image";
import CrewApp, { CameraIcon } from "./CrewApp";
import { PHOTO_UPLOAD_ON } from "@/lib/uploadPhoto";

type Prediction = { asset_id: string; p_block: number; level: Level; reasons: string[] };
type Role = null | "manager" | "split";
const LOG_PREVIEW = 5; // rows shown before "Show today's full log"
// Phone breakpoint: keep in step with the max-width: 899px rules in globals.css.
const NARROW_QUERY = "(max-width: 899px)";
type PanelTab = "queue" | "plan" | "records" | "crews";
const TABS: { id: PanelTab; label: string; short: string }[] = [
  { id: "queue", label: "Check next", short: "Queue" },
  { id: "plan", label: "Run plan", short: "Plan" },
  { id: "records", label: "Records", short: "Records" },
  { id: "crews", label: "Crews", short: "Crews" },
];

// Public build (Vercel): no risk-api, so the page only reads the baked scores file. Set at build time.
const PUBLIC_BUILD = process.env.NEXT_PUBLIC_PUBLIC_BUILD === "1";
const DEFAULT_LEAF = 60; // leaf-fall slider at first load, same as the precomputed scenario

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
  const [narrow, setNarrow] = useState(false); // phone width: same breakpoint as the one-column layout in globals.css
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const [leaf, setLeaf] = useState(DEFAULT_LEAF);
  const [day, setDay] = useState(0); // 0 = Today; later days score tomorrow's conditions so crews can be planned ahead
  const [extra, setExtra] = useState(0);
  const [capacity, setCapacity] = useState(3); // assumption: the real truck size is not known
  const [preds, setPreds] = useState<Prediction[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false); // true when the scores come from the precomputed file
  const [st, setSt] = useState<SavedState>({ crews: DEFAULT_CREWS, runs: {}, records: [], log: [] });
  const [logOpen, setLogOpen] = useState(false);
  const [hiddenLogCrews, setHiddenLogCrews] = useState<string[]>([]); // crews unticked in the Activity log
  const [confirm, setConfirm] = useState<{ kind: "withdraw" | "remove"; crewId: string } | null>(null);
  const [resetAsk, setResetAsk] = useState(false); // confirm before clearing the sample session
  const [choose, setChoose] = useState<RunStop[] | null>(null); // stops waiting for the manager to pick a crew
  const [whatIfBlock, setWhatIfBlock] = useState(false); // a send was stopped because the what-if sliders are moved
  const [hiddenCrews, setHiddenCrews] = useState<string[]>([]); // crews unticked in the map legend
  const [cur, setCur] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [clock, setClock] = useState("--:--"); // real Sydney time; set after mount so server and browser HTML match
  const [view, setView] = useState<"2d" | "3d">("2d");
  // Before photos a person has already confirmed on /review, as "runId:stopId". Those no longer wait for review.
  const [reviewed, setReviewed] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!PHOTO_UPLOAD_ON) return;
    let live = true;
    const pull = async () => {
      try {
        const res = await fetch("/api/review/photos", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { photos?: { runId: string; stopId: string; confirmed: number | null }[] };
        if (live && data.photos) {
          setReviewed(new Set(data.photos.filter((p) => p.confirmed !== null).map((p) => `${p.runId}:${p.stopId}`)));
        }
      } catch {
        /* offline: keep the last known set */
      }
    };
    void pull();
    const tick = setInterval(pull, 10_000);
    window.addEventListener("focus", pull);
    return () => {
      live = false;
      clearInterval(tick);
      window.removeEventListener("focus", pull);
    };
  }, []);

  useEffect(() => {
    const read = () => setSt(loadState());
    read();
    const un = subscribeRun(read);
    const tick = setInterval(() => setClock(sydneyClock()), 400);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the clock is read after mount so server and browser HTML match
    setClock(sydneyClock());
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
  // Real BoM forecast for Parramatta (server route /api/bom). Until it arrives, or if it fails, the sample rain is used.
  const [bom, setBom] = useState<{
    source: string;
    copyright: string;
    fetchedAt: string;
    issuedAt: string;
    days: BomDay[];
  } | null>(null);
  const [bomFailed, setBomFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/bom")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bom"))))
      .then((d) => live && setBom(d))
      .catch(() => live && setBomFailed(true));
    return () => {
      live = false;
    };
  }, []);
  // Real rain reading so far today (BoM, Sydney Olympic Park AWS), refreshed every 10 minutes.
  const [obs, setObs] = useState<{ station: string; observedAt: string; rainMm: number } | null>(null);
  const [obsFailed, setObsFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/rain-obs")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("obs"))))
        .then((d) => {
          if (live) {
            setObs(d);
            setObsFailed(false);
          }
        })
        .catch(() => live && setObsFailed(true));
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  const dayRain = useMemo(
    () => (bom ? DAYS.map((_, k) => dayRainMm(bom.days.find((d) => d.date === sydneyDate(k))) ?? 0) : DAY_RAIN_MM),
    [bom],
  );
  const hz = horizonInputs(day, extra, dayRain);
  // Rain over the chosen period in 3-hour blocks (6-hour when long) and its running total. Daily totals come from BoM;
  // the split inside a day is an assumed pattern (see rainBlocks.ts).
  const blocks = useMemo(() => {
    const hour = Number(clock.slice(0, 2));
    return rainBlocks({
      dayRain,
      days: day + 1,
      extraMm: extra,
      nowHour: Number.isNaN(hour) ? 0 : hour,
      unitHours: unitFor(day + 1),
    });
  }, [dayRain, day, extra, clock]);
  // Rain intensity for the 3D water picture: the first block of the chart, in mm per hour (forecast, not a reading).
  const rainRate = blocks.length ? (blocks[0].baseMm + blocks[0].extraMm) / unitFor(day + 1) : 0;
  // The scores on screen belong to scoredKey. While it differs from the inputs now chosen, new scores are on the way.
  const [scoredKey, setScoredKey] = useState<string | null>(null);
  const rainForecast = hz.rain_forecast_mm;
  const scoreKey = `${leaf}|${rainForecast}|${hz.days_added}|${hz.rain_mm_7d}|${[...cleaned].sort().join(",")}`;
  const scoring = scoredKey !== scoreKey;
  // Live scores by scenario, kept for this page load. Going back to a scenario already scored (for example Today after
  // looking at Tomorrow) shows it at once and asks nobody. Fallback scores are never stored.
  const scoreCache = useRef(new Map<string, Prediction[]>());
  useEffect(() => {
    const hit = scoreCache.current.get(scoreKey);
    const t = setTimeout(
      async () => {
        if (hit) {
          setPreds(hit);
          setError(null);
          setOffline(false);
          setScoredKey(scoreKey);
          return;
        }
        let live: LiveResult<Prediction>;
        try {
          const inputs = seed.map((a) => ({
            asset_id: a.id,
            type: a.type,
            canopy_pct: a.canopyPct,
            leaf_index: leaf,
            rain_mm_7d: hz.rain_mm_7d,
            rain_forecast_mm: rainForecast,
            days_since_clean: (cleaned.has(a.id) ? 0 : a.daysSinceClean) + hz.days_added,
            has_camera: a.hasCamera,
          }));
          if (PUBLIC_BUILD) {
            // No risk-api on the public build: run the exported trees in the browser (same answers, see riskModel.test.ts).
            live = { ok: true, scores: predictLocal(riskModel as unknown as ModelJson, inputs) };
          } else {
            const res = await fetch("/api/risk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(inputs),
            });
            const data = await res.json();
            live =
              res.ok && Array.isArray(data)
                ? { ok: true, scores: data }
                : { ok: false, error: data.error ?? "request failed" };
          }
        } catch (e) {
          live = { ok: false, error: e instanceof Error ? e.message : "request failed" };
        }
        const r = resolveScores(live, precomputed.scores as Prediction[]);
        setScoredKey(scoreKey);
        if (r.status === "live") {
          const cache = scoreCache.current;
          cache.set(scoreKey, r.scores);
          if (cache.size > 60) cache.delete(cache.keys().next().value as string); // oldest first
        }
        if (r.status === "error") {
          setPreds(null);
          setError(r.error);
          setOffline(false);
        } else {
          setPreds(r.scores);
          setError(null);
          setOffline(r.status === "precomputed");
          if (r.status === "precomputed") {
            // The file holds the default scenario only, so the what-if controls go back to it.
            setLeaf(precomputed.scenario.leaf_index);
            setExtra(0);
            setDay(0);
          }
        }
      },
      hit ? 0 : 250,
    );
    return () => clearTimeout(t);
  }, [seed, leaf, rainForecast, hz.days_added, hz.rain_mm_7d, cleaned, scoreKey]);

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
    const ids = r && !hiddenCrews.includes(c.id) ? openStops(r).map((s) => s.id) : [];
    return ids.length ? [{ name: c.name, color: HATS[i % HATS.length], ids }] : [];
  });
  const stopCrew = new Map<string, { color: string; letter: string }>();
  st.crews.forEach((c, i) => {
    const r = hiddenCrews.includes(c.id) ? undefined : st.runs[c.id];
    if (r)
      openStops(r).forEach((s) => stopCrew.set(s.id, { color: HATS[i % HATS.length], letter: crewLetter(c.name) }));
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
    pct: state === "done" ? undefined : Math.min(99, Math.round(p.p_block * 100)),
    daysSinceClean: state === "done" ? 0 : a.daysSinceClean,
  }));

  const mapCrews: MapCrew[] = st.crews.map((c, i) => {
    const r = st.runs[c.id];
    const next = r && r.accepted && isBusy(r) ? openStops(r)[0] : undefined;
    const spot = next ? byId.get(next.id) : undefined;
    return {
      id: c.id,
      name: c.name,
      hat: HATS[i % HATS.length],
      letter: crewLetter(c.name),
      x: spot ? spot.x + 24 : DEPOT.x + (i - 1) * 24 + 24,
      y: spot ? spot.y + 26 : DEPOT.y + 34,
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
    const t = sydneyClock();
    const msg =
      stops.length > 1
        ? `${target.name} sent on a run: ${stops.map((s) => s.id).join(", ")} (${stops.length} stops), ${total.toFixed(1)} of ${capacity.toFixed(1)} m³ (estimated).`
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
    const left = openStops(r);
    const kept = r.stops.filter((s) => r.done.includes(s.id));
    const msg = `${crew.name} withdrawn from ${left.map((s) => s.id).join(", ")}. Back in the queue.`;
    save({
      ...st,
      runs: { ...st.runs, [crewId]: kept.length ? { ...r, stops: kept } : undefined },
      log: addLog(st.log, sydneyClock(), msg, { crewId }),
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
    sendOrWarn([stopFor(id, one.load, one.photosNeeded)]);
  }

  // Crews are sent on current conditions only. If the what-if sliders are moved, ask before sending anything.
  const whatIfOn = leaf !== DEFAULT_LEAF || extra !== 0 || day !== 0;
  function sendOrWarn(stops: RunStop[]) {
    if (whatIfOn) setWhatIfBlock(true);
    else setChoose(stops);
  }

  const openAsset = (id: string) => {
    if (rows.find((r) => r.a.id === id)?.state === "idle") setCur(id);
  };

  const showMap = role === "manager" || role === "split";
  const showPhone = role === "split";
  // Wide Manager shows every panel at once; side-by-side and phone-width Manager use tabs to save room.
  const tabbed = showPhone || narrow;
  const high = idle.filter((r) => r.p.level === "high").length;
  const curRow = cur ? rows.find((r) => r.a.id === cur) : undefined;
  const planPct = Math.min(100, Math.round((plan.totalLoad / capacity) * 100));
  const photoRecs = records.filter((r) => r.method === "photos");
  // One row per decline, skip or early end (a run that ends sends several stops back at once).
  const returnEvents = (() => {
    const out: (Returned & { key: string; crew: string; stopIds: string[] })[] = [];
    for (const r of st.returns ?? []) {
      const key = `${r.runId}|${r.kind}|${r.at}`;
      const hit = out.find((o) => o.key === key);
      if (hit) hit.stopIds.push(r.stopId);
      else
        out.push({
          ...r,
          key,
          crew: st.crews.find((c) => c.id === r.crewId)?.name ?? "A crew",
          stopIds: [r.stopId],
        });
    }
    return out;
  })();

  const confirmCrew = confirm ? st.crews.find((c) => c.id === confirm.crewId) : undefined;
  const confirmRun = confirmCrew ? st.runs[confirmCrew.id] : undefined;
  const confirmView = (() => {
    if (!confirm || !confirmCrew) return null;
    const name = confirmCrew.name;
    const cleanedBy = records.filter((r) => r.crewId === name).length;
    if (confirm.kind === "withdraw") {
      const left = confirmRun ? openStops(confirmRun) : [];
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
    <section className="fr-section fr-wide" {...panelProps("records", "Records")}>
      <div className="fr-label">Compliance records</div>
      <RecordsBadge />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Stat
          n={photoRecs.filter((r) => r.before && !(PHOTO_UPLOAD_ON && reviewed.has(`${r.runId}:${r.stopId}`))).length}
          color="#FFD27A"
          l1="Before photos"
          l2={PHOTO_UPLOAD_ON ? "to review" : "AI training"}
        />
        <Stat n={photoRecs.filter((r) => r.after).length} color="#7ED9A3" l1="After photos" l2="evidence" />
        <Stat n={records.filter((r) => r.method === "camera").length} color="#4FC3E8" l1="Camera" l2="checks" />
      </div>
      <div className="fr-recact">
        <Link className="fr-btn fr-sec" href="/review" style={{ textDecoration: "none" }}>
          Review before photos
        </Link>
        <Link className="fr-btn fr-sec" href="/model" style={{ textDecoration: "none" }}>
          How the model works
        </Link>
        <Link className="fr-btn fr-sec" href="/report" style={{ textDecoration: "none" }}>
          Email report
        </Link>
        <span className="fr-recnote">Photo review uses mock AI unless a key is set.</span>
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
      {returnEvents.length > 0 && (
        <>
          <div className="fr-label" style={{ marginTop: 16 }}>
            Sent back to the queue
          </div>
          <ul
            style={{
              listStyle: "none",
              margin: "10px 0 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {returnEvents.slice(0, 3).map((e) => {
              const ci = st.crews.findIndex((c) => c.id === e.crewId);
              return (
                <li
                  key={e.key}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    background: "#0B2233",
                    borderRadius: 12,
                    padding: "8px 10px",
                    fontSize: 13,
                    lineHeight: 1.35,
                    color: "#CFE6F0",
                  }}
                >
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
                  <div>
                    <b>
                      {e.kind === "declined" ? "Declined" : e.kind === "skipped" ? "Skipped" : "Ended early"}:{" "}
                      {reasonLabel(e.reason)}
                    </b>
                    {e.note ? ` (${e.note})` : ""}
                    <br />
                    {e.crew} · {e.stopIds.join(", ")}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {records.length > 3 && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#B9D6E3" }}>
          Showing the latest 3 of {records.length} records.
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: "#8FB8CC", lineHeight: 1.4 }}>
        {PHOTO_UPLOAD_ON
          ? "Sample records, metadata only. Crew photos are saved to the sample project for review, not shown here, and not used for training. A face and number-plate check is required before any training use and is not built."
          : "Sample records, metadata only. Photos are not stored by the manager screen. Real photos would carry time and location, be stored with the work order, and be checked for faces and number plates before use in training."}
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
          // Latest early end or decline by this crew, shown until a newer run replaces it.
          const sent = (st.returns ?? []).find((x) => x.crewId === c.id && x.kind !== "skipped");
          const sentNote =
            !isBusy(r) && sent && (!r || r.runId === sent.runId)
              ? `${sent.kind === "declined" ? "Declined" : "Ended early"}: ${reasonLabel(sent.reason)}`
              : "";
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
                {sentNote && (
                  <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#FFB38A" }}>{sentNote}</span>
                )}
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

  const allLogRows = [...st.log, { t: "13:00", x: "Shift started. Risk scores update with leaf fall and rain." }];
  // Entries without a crew (shift start, manager actions) always stay; the toggles only hide crew entries.
  const logRows = allLogRows.filter((l) => !l.crewId || !hiddenLogCrews.includes(l.crewId));
  const allLogCrewsHidden = st.crews.length > 0 && st.crews.every((c) => hiddenLogCrews.includes(c.id));
  const logPanel = (
    <section className="fr-section" hidden={tabbed && tab !== "crews"} aria-label="Activity log">
      <div className="fr-label">Activity log</div>
      <div style={{ marginTop: 6, fontSize: 14, color: "#B9D6E3" }}>
        <CrewToggles
          crews={st.crews.map((c, i) => ({ id: c.id, name: c.name, hat: HATS[i % HATS.length] }))}
          hidden={hiddenLogCrews}
          onToggle={(id) => setHiddenLogCrews((h) => (h.includes(id) ? h.filter((x) => x !== id) : [...h, id]))}
          label="Show in log:"
          suffix="in the log"
        />
      </div>
      {allLogCrewsHidden && (
        <div style={{ marginTop: 6, fontSize: 13, color: "#8FB8CC" }}>All crews hidden. Showing shift events only.</div>
      )}
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
        onClick={() => setResetAsk(true)}
      >
        Reset sample session
      </button>
    </section>
  );

  return (
    <div style={{ minHeight: "100dvh", position: "relative", background: "#0B2233", color: "#EAF6FB" }}>
      {role === "manager" || role === "split" ? (
        <div
          data-fr-header
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
          <div
            style={
              narrow
                ? { display: "flex", flexDirection: "column", gap: 2, width: "100%" }
                : { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }
            }
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                width: narrow ? "100%" : undefined,
              }}
            >
              <button
                type="button"
                aria-label="DrainWise, back to home"
                title="Back to home"
                onClick={() => {
                  setRole(null);
                  setCur(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  background: "none",
                  border: 0,
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <Image src="/brand-mascot.png" alt="" width={46} height={40} unoptimized />
                <Image src="/brand-wordmark.png" alt="" width={120} height={27} unoptimized />
              </button>
              {narrow && (
                <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <ReviewBell />
                  <RoomChip />
                </span>
              )}
            </div>
            <span
              style={
                narrow
                  ? { fontSize: 11, fontWeight: 600, color: "#8FB8CC" }
                  : {
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#B9D6E3",
                      border: "1px solid #2D6182",
                      borderRadius: 999,
                      padding: "4px 12px",
                    }
              }
            >
              Simulation · sample data
            </span>
          </div>
          <div className="fr-hdr2">
            <div className="fr-hdrtiles">
              <div className="fr-tile" style={{ width: 132 }}>
                <div>SYDNEY TIME</div>
                <div>{clock}</div>
              </div>
              <Tip
                className="fr-tile"
                style={{ width: 160 }}
                tip={
                  obs ? (
                    <>
                      <b>Rain since 9am</b>
                      <span className="fr-tip-sub">{obs.station}</span>
                      <span>
                        {obs.rainMm} mm · read {obs.observedAt.slice(11, 16)} Sydney time
                      </span>
                      <span className="fr-tip-sub">Source: Bureau of Meteorology</span>
                    </>
                  ) : (
                    <>
                      <b>Rain since 9am</b>
                      <span>{obsFailed ? "No reading available right now" : "Loading the latest reading"}</span>
                      <span className="fr-tip-sub">Source: Bureau of Meteorology</span>
                    </>
                  )
                }
              >
                <div>RAIN SINCE 9AM</div>
                <div>{obs ? `${obs.rainMm} mm` : obsFailed ? "no data" : "…"}</div>
              </Tip>
              <div className="fr-tile" style={{ width: 132 }}>
                <div>HIGH RISK</div>
                <div>
                  {high} of {seed.length}
                </div>
              </div>
              <div className="fr-tile" style={{ width: 164 }}>
                <div>CLEANED TODAY</div>
                <div>{records.length}</div>
              </div>
            </div>
            <div className="fr-hdracts">
              {!narrow && <ReviewBell />}
              {!narrow && <RoomChip />}
              {!narrow && (
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
              )}
            </div>
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
            {offline && (
              <div
                role="status"
                style={{
                  margin: "0 0 12px",
                  background: "#102F45",
                  border: "2px dashed #FFD27A",
                  borderRadius: 14,
                  padding: "10px 14px",
                  fontSize: 14,
                  lineHeight: 1.4,
                }}
              >
                <strong>Offline: showing precomputed sample scores (risk-api offline)</strong>
                <div style={{ color: "#CFE6F0", fontSize: 13, marginTop: 2 }}>
                  SAMPLE DATA · generated {precomputed.generated_at.slice(0, 16).replace("T", " ")} UTC · model{" "}
                  {precomputed.model_version}. The what-if sliders are off, and cleaned assets keep their precomputed
                  score. Start the risk API with <code>uvicorn risk_api.main:app</code> and reload to go live.
                </div>
              </div>
            )}
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
              {view === "3d" ? (
                <Map3D assets={mapAssets} crews={mapCrews} rainMmH={rainRate} extra={extra} onOpen={openAsset} />
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
              {scoring && (
                <div role="status" className="fr-wait">
                  <i aria-hidden="true" />
                  Updating risk scores…
                </div>
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
              </div>
            )}
          </section>

          <aside className="fr-side" aria-label="Manager panels">
            {narrow && toast && (
              <div aria-hidden="true" className="fr-tabtoast">
                {toast}
              </div>
            )}
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
                    {narrow ? t.short : t.label}
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
                    className="fr-qrow"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      background: "#0B2233",
                      borderRadius: 14,
                      padding: "10px 12px",
                    }}
                  >
                    <div className="fr-qtext">
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
                      {(() => {
                        const back = lastReturn(st.returns, a.id);
                        if (!back) return null;
                        const who = st.crews.find((c) => c.id === back.crewId)?.name ?? "A crew";
                        return (
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#FFB38A", lineHeight: 1.35 }}>
                            Returned by {who}: {reasonLabel(back.reason)}
                          </div>
                        );
                      })()}
                    </div>
                    <button
                      type="button"
                      className="fr-btn fr-ghost"
                      style={{ padding: "6px 12px", minHeight: 40, fontSize: 14 }}
                      onClick={() => openAsset(a.id)}
                      aria-label={`Details for ${a.id}${a.hasCamera ? ", has a camera" : ""}`}
                    >
                      Details
                    </button>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div className="fr-label">Truck run planner</div>
                <HowItWorks className="fr-btn fr-ghost" />
              </div>
              <div style={{ margin: "2px 0 0", fontSize: 13, lineHeight: 1.4, color: "#8FB8CC" }}>
                A suggestion for the contractor, who picks the day and the people.
              </div>
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
                    onClick={() => sendOrWarn(plan.stops.map((s) => stopFor(s.id, s.load, s.photosNeeded)))}
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
                capacity, then are ordered nearest-first from the depot. Load sizes are sample estimates. The 3 m³ truck
                default is an assumption; real truck and bin volumes come from the contractor and council.
              </div>
            </section>

            {tabbed && recordsPanel}
            {tabbed && crewsPanel}
            {tabbed && logPanel}

            <details className="fr-sim" key={tabbed ? "tabbed" : "dash"} open={!narrow}>
              <summary>Simulation controls · What if and rain forecast</summary>
              <section className="fr-group">
                <div className="fr-label">
                  What if · demo controls
                  {offline ? " · off while risk-api is offline" : ""}
                </div>
                <label
                  htmlFor="fr-day"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 15,
                    fontWeight: 600,
                    marginTop: 16,
                  }}
                >
                  <span>Forecast day</span>
                  <span style={{ color: "#CFE6F0" }}>{DAYS[day]}</span>
                </label>
                <input
                  id="fr-day"
                  type="range"
                  min={0}
                  max={DAYS.length - 1}
                  step={1}
                  value={day}
                  disabled={offline}
                  aria-valuetext={DAYS[day]}
                  onChange={(e) => setDay(+e.target.value)}
                  style={{ width: "100%", accentColor: "#4FC3E8", opacity: offline ? 0.4 : 1 }}
                />
                <div
                  aria-hidden="true"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: "#8FB8CC",
                    marginTop: -2,
                  }}
                >
                  {DAYS.map((name, i) => (
                    <span key={name}>{i === 0 ? "Today" : `+${i}d`}</span>
                  ))}
                </div>
                {day > 0 && (
                  <div style={{ marginTop: 6, fontSize: 13, color: "#8FB8CC", lineHeight: 1.4 }}>
                    Showing {DAYS[day].toLowerCase()}: assets are {day} day(s) older and the sample rain in between has
                    fallen. A crew can be sent only on today&apos;s scores.
                  </div>
                )}
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
                  disabled={offline}
                  onChange={(e) => setLeaf(+e.target.value)}
                  style={{ width: "100%", accentColor: "#FFD27A", opacity: offline ? 0.4 : 1 }}
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
                    {extra === 0 ? "Forecast as is" : `+${extra} mm`} over {day + 1} day{day === 0 ? "" : "s"}
                  </span>
                </label>
                <input
                  id="fr-extra"
                  type="range"
                  min={0}
                  max={100}
                  value={extra}
                  disabled={offline}
                  onChange={(e) => setExtra(+e.target.value)}
                  style={{ width: "100%", accentColor: "#FF8A4C", opacity: offline ? 0.4 : 1 }}
                />
                <button
                  type="button"
                  className="fr-btn fr-ghost"
                  style={{ marginTop: 10 }}
                  disabled={offline || (leaf === DEFAULT_LEAF && extra === 0 && day === 0)}
                  onClick={() => {
                    setLeaf(DEFAULT_LEAF);
                    setExtra(0);
                    setDay(0);
                  }}
                >
                  Reset to current conditions
                </button>
                <div style={{ marginTop: 10, fontSize: 13, color: "#8FB8CC", lineHeight: 1.4 }}>
                  Risk scores come from a gradient boosting model trained on simulated history, not on real council
                  records. Every score shows its reasons.
                </div>
              </section>

              <section className="fr-group">
                <div className="fr-label">Rain forecast · {day === 0 ? "rest of today" : `next ${day + 1} days`}</div>
                <div className="fr-sub">
                  Every {unitFor(day + 1)} hours (hour of day, Sydney time) · bars = rain in the block, line = running
                  total. Under each day: BoM rain range and chance of rain
                </div>
                <RainChart
                  blocks={blocks}
                  unitHours={unitFor(day + 1)}
                  days={DAYS.slice(0, day + 1).map((_, i) => {
                    const d = bom?.days.find((x) => x.date === sydneyDate(i));
                    const name =
                      i === 0
                        ? "Today"
                        : new Intl.DateTimeFormat("en-AU", {
                            timeZone: "Australia/Sydney",
                            weekday: "short",
                            day: "numeric",
                          }).format(new Date(`${sydneyDate(i)}T12:00:00Z`));
                    return {
                      name,
                      range: !bom
                        ? "sample"
                        : !d
                          ? "no data"
                          : d.lowMm === null
                            ? "no rain"
                            : `${d.lowMm}–${d.highMm} mm`,
                      chance: bom && d?.popPct != null ? `${d.popPct}% chance` : "",
                    };
                  })}
                />
                <div style={{ marginTop: 10, fontSize: 13, color: "#8FB8CC", lineHeight: 1.4 }}>
                  {bom ? (
                    <>
                      Source:{" "}
                      <a href={bom.copyright} target="_blank" rel="noreferrer" style={{ color: "#8FD8F0" }}>
                        Australian Government Bureau of Meteorology
                      </a>
                      , precis forecast for Parramatta, issued {bom.issuedAt.slice(0, 16).replace("T", " ")} Sydney
                      time, read {bom.fetchedAt.slice(11, 16)} UTC. A forecast is a chance, not a fact: the range means
                      a 75% chance of at least the first amount and a 25% chance of at least the second. The daily total
                      used is the middle of the range; no range means no rain expected (0 mm).
                    </>
                  ) : bomFailed ? (
                    "The Bureau of Meteorology forecast could not be loaded, so sample rain is used. Not a forecast."
                  ) : (
                    "Loading the Bureau of Meteorology forecast. Sample rain until it arrives."
                  )}{" "}
                  {obs && (
                    <>
                      Rain so far today: {obs.rainMm} mm since 9am, measured at {obs.station} (a few km east of
                      Parramatta), read at {obs.observedAt.slice(11, 16)} Sydney time.{" "}
                    </>
                  )}
                  The free BoM forecast has no 3-hourly rain, so how each day&apos;s rain is split into blocks is an
                  assumption (a fixed sample pattern, most rain in the afternoon). Light blue on top of a bar is what-if
                  rain from the Extra rain slider.
                </div>
              </section>
            </details>
            {!tabbed && recordsPanel}
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
            {curRow.a.hasCamera ? "This site has a camera." : "No camera here, so this is a model estimate."}
          </p>
          {curRow.a.hasCamera && <CameraView key={curRow.a.id} assetId={curRow.a.id} />}
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

      {resetAsk && (
        <ConfirmDialog
          label="Reset sample session"
          eyebrow="Reset"
          title="Reset the sample session?"
          confirmLabel="Reset session"
          onCancel={() => setResetAsk(false)}
          onConfirm={() => {
            resetAll();
            setCur(null);
            setResetAsk(false);
          }}
        >
          <p style={{ margin: "0 0 10px" }}>
            This clears the current run, every crew&apos;s state, the activity log and the completed-job records in this
            sample session.{" "}
            {role === "split" ? "The crew phone resets too." : "Any crew phone in this team resets too."}
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#8FB8CC" }}>
            Risk scores and the sample map stay as they are. Photos already saved for review are not deleted.
          </p>
        </ConfirmDialog>
      )}

      {whatIfBlock && (
        <ConfirmDialog
          label="What-if is on"
          eyebrow="Send a crew"
          title="What-if scores are on. Restore current conditions?"
          tone="info"
          confirmLabel="Restore current conditions"
          onCancel={() => setWhatIfBlock(false)}
          onConfirm={() => {
            setLeaf(DEFAULT_LEAF);
            setExtra(0);
            setDay(0);
            setWhatIfBlock(false);
          }}
        >
          <p style={{ margin: "0 0 10px" }}>
            No crew was sent. The map and queue show a what-if ({day === 0 ? "today" : DAYS[day].toLowerCase()}, leaf
            fall {leaf}%, {extra === 0 ? "forecast rain" : `+${extra} mm rain`}), not current conditions.
          </p>
          <p style={{ margin: 0, fontSize: 14, color: "#8FB8CC" }}>
            Restoring puts the day and both sliders back and recalculates the scores. Then press send again: the stops
            may change. Cancel keeps the what-if so you can keep exploring.
          </p>
        </ConfirmDialog>
      )}

      {choose && showMap && (
        <CrewChooser
          crews={st.crews}
          runs={st.runs}
          count={choose.length}
          avoid={recentReturners(
            st.returns,
            choose.map((x) => x.id),
            Date.now(),
          )}
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
  avoid,
  onPick,
  onCancel,
}: {
  crews: SavedState["crews"];
  runs: SavedState["runs"];
  count: number;
  avoid: Set<string>; // crews that sent one of these stops back in the last 24 hours: not pre-selected
  onPick: (id: string) => void;
  onCancel: () => void;
}) {
  const list = crews
    .map((c, i) => ({ c, color: HATS[i % HATS.length], isBusy: isBusy(runs[c.id]) }))
    .sort((m, n) => m.c.name.localeCompare(n.c.name, undefined, { sensitivity: "base", numeric: true }));
  const firstFree = (() => {
    const i = list.findIndex((x) => !x.isBusy && !avoid.has(x.c.id));
    return i >= 0 ? i : list.findIndex((x) => !x.isBusy);
  })();
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
        {count > 1 ? `A run of ${count} stops.` : "One stop."} This is a suggestion for the contractor, who picks the
        day and the people. Crews already out on a run can&apos;t take it.
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
                {out ? "Out on a run" : avoid.has(c.id) ? "Sent this back" : "Available"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
