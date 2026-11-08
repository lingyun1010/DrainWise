// Demo-only handoff between the manager and crew screens (same browser, localStorage).
// Photos are NOT stored here: they live in memory only and are never persisted.
export type RunStop = {
  id: string;
  load: number;
  photosNeeded: boolean;
  typeLabel?: string;
  pct?: number;
  tier?: string;
  why?: string;
};
// Metadata only: no image data. before = AI training candidate, after = evidence of work.
export type JobRecord = {
  stopId: string;
  runId: string;
  crewId: string;
  at: string; // ISO timestamp
  clock: string; // simulated shift clock, for display
  pct?: number;
  method: "camera" | "photos";
  before: boolean;
  after: boolean;
};
// crewId colours the entry; runId (set on dispatch entries) lets the manager withdraw that run.
export type LogEntry = { t: string; x: string; crewId?: string; runId?: string };
// One run per crew, plus records and log shared by everyone ("cleaned today").
export type CrewRun = {
  runId: string;
  crew: string; // crew id
  stops: RunStop[];
  capacity: number;
  accepted: boolean;
  done: string[];
};
export type Crew = { id: string; name: string };
export type SavedState = {
  crews: Crew[];
  runs: Record<string, CrewRun | undefined>; // keyed by crew id
  records: JobRecord[];
  log: LogEntry[];
};
export const DEFAULT_CREWS: Crew[] = [
  { id: "c1", name: "Crew A" },
  { id: "c2", name: "Crew B" },
  { id: "c3", name: "Crew C" },
];
// Short badge for a crew: "Crew B" -> "B", "Maria" -> "M".
export function crewLetter(name: string): string {
  const m = name.trim().match(/^crew\s+(\S)/i);
  return (m ? m[1] : name.trim().charAt(0)).toUpperCase() || "?";
}
// One colour per crew (hat, ring and route on the map). Chosen to stay clear of the risk colours (orange, yellow, blue).
export const HATS = ["#FF5CA8", "#5BE38A", "#B38BFF", "#2ED3C6", "#F2F2F2", "#C98B4B"];

const KEY = "drainwise.state";
const EVT = "drainwise-run";
const EMPTY: SavedState = { crews: DEFAULT_CREWS, runs: {}, records: [], log: [] };

export function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const st = JSON.parse(raw) as SavedState;
    return st.crews?.length ? st : { ...st, crews: DEFAULT_CREWS };
  } catch {
    return EMPTY;
  }
}

export function saveState(state: SavedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: demo handoff just won't persist */
  }
  window.dispatchEvent(new Event(EVT)); // same-tab listeners (split view)
}

export function resetAll(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem("drainwise.run"); // legacy single-run key
    localStorage.removeItem("drainwise.t0");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVT));
}

export function subscribeRun(fn: () => void): () => void {
  window.addEventListener(EVT, fn);
  window.addEventListener("storage", fn);
  window.addEventListener("focus", fn);
  return () => {
    window.removeEventListener(EVT, fn);
    window.removeEventListener("storage", fn);
    window.removeEventListener("focus", fn);
  };
}

export function addLog(
  log: LogEntry[] | undefined,
  t: string,
  x: string,
  meta: { crewId?: string; runId?: string } = {},
): LogEntry[] {
  return [{ t, x, ...meta }, ...(log ?? [])].slice(0, 300);
}

export function isBusy(run: CrewRun | undefined | null): boolean {
  return !!run && run.stops.some((s) => !run.done.includes(s.id));
}

// Stop ids still to clean across all crews, so two crews are never sent to the same asset.
export function openStopIds(state: SavedState): Set<string> {
  const ids = new Set<string>();
  for (const r of Object.values(state.runs)) {
    if (r) for (const s of r.stops) if (!r.done.includes(s.id)) ids.add(s.id);
  }
  return ids;
}

// Simulated shift clock shared by both screens: starts 13:00, one real second = 5 simulated minutes.
export const FORECAST = [4, 9, 22, 31, 18, 7]; // mm/h for 13:00..18:00, SAMPLE values
function t0(): number {
  try {
    const v = localStorage.getItem("drainwise.t0");
    if (v) return +v;
    const n = Date.now();
    localStorage.setItem("drainwise.t0", String(n));
    return n;
  } catch {
    return Date.now();
  }
}
export function simMinute(): number {
  return Math.floor(((Date.now() - t0()) / 1000) * 5) % 360;
}
export function fmtClock(m: number): string {
  const h = 13 + Math.floor(m / 60);
  const mm = m % 60;
  return h + ":" + (mm < 10 ? "0" : "") + mm;
}
export function rainNow(m: number): number {
  const i = Math.floor(m / 60);
  const f = (m % 60) / 60;
  const nx = FORECAST[Math.min(i + 1, 5)];
  return FORECAST[i] + (nx - FORECAST[i]) * f;
}
