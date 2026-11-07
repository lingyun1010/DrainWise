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
export type LogEntry = { t: string; x: string };
export type SavedRun = {
  runId?: string;
  crew?: string;
  stops: RunStop[];
  capacity: number;
  accepted: boolean;
  done: string[];
  records?: JobRecord[]; // cumulative across runs ("cleaned today")
  log?: LogEntry[];
};

const KEY = "drainwise.run";
const EVT = "drainwise-run";

export function loadRun(): SavedRun | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedRun) : null;
  } catch {
    return null;
  }
}

export function saveRun(run: SavedRun): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(run));
  } catch {
    /* storage unavailable: demo handoff just won't persist */
  }
  window.dispatchEvent(new Event(EVT)); // same-tab listeners (split view)
}

export function resetAll(): void {
  try {
    localStorage.removeItem(KEY);
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

export function addLog(log: LogEntry[] | undefined, t: string, x: string): LogEntry[] {
  return [{ t, x }, ...(log ?? [])].slice(0, 8);
}

export function isBusy(run: SavedRun | null): boolean {
  return !!run && run.stops.some((s) => !run.done.includes(s.id));
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
