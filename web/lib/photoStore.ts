// Server-only access to the DrainWise Supabase project for crew photos (ticket 16).
// Talks to Supabase over plain fetch with the service role key, which only ever lives in server
// env vars (web/.env.local locally, Vercel env vars for the public demo). It is never sent to the browser.
// The bucket is private and the table has no policies, so nothing here is reachable without that key.
import "server-only";
import { randomUUID } from "node:crypto";
import { MAX_STORED_PHOTOS, photoPath, type PhotoKind } from "../../planner/src/photoUpload";

const BUCKET = "job-photos";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(raw: unknown): raw is string {
  return typeof raw === "string" && UUID.test(raw);
}

export function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export function storageConfigured(): boolean {
  return config() !== null;
}

export function auth(key: string): Record<string, string> {
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export type PhotoRow = {
  id: string;
  created_at: string;
  run_id: string;
  stop_id: string;
  asset_id: string;
  crew_id: string;
  kind: PhotoKind;
  path: string;
  expires_at: string | null;
  suggested_level: number | null;
  confirmed_level: number | null;
  confirmed_at: string | null;
};
const COLUMNS =
  "id,created_at,run_id,stop_id,asset_id,crew_id,kind,path,expires_at,suggested_level,confirmed_level,confirmed_at";

async function rows(query: string, init?: RequestInit): Promise<{ data: PhotoRow[]; count: number | null } | null> {
  const c = config();
  if (!c) return null;
  try {
    const res = await fetch(`${c.url}/rest/v1/job_photos?${query}`, {
      ...init,
      headers: { ...auth(c.key), ...init?.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const range = res.headers.get("content-range"); // "0-0/12" when Prefer: count=exact
    const total = range?.split("/")[1];
    const text = await res.text();
    return { data: text ? (JSON.parse(text) as PhotoRow[]) : [], count: total && total !== "*" ? Number(total) : null };
  } catch {
    return null;
  }
}

async function removeObjects(paths: string[]): Promise<boolean> {
  const c = config();
  if (!c || paths.length === 0) return true;
  try {
    const res = await fetch(`${c.url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: { ...auth(c.key), "Content-Type": "application/json" },
      body: JSON.stringify({ prefixes: paths }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type SaveResult = { ok: true; id: string } | { ok: false; status: number; error: string };

export async function savePhoto(
  meta: { runId: string; stopId: string; assetId: string; crewId: string; kind: PhotoKind; expiresAt: string | null },
  bytes: Uint8Array,
): Promise<SaveResult> {
  const c = config();
  if (!c) return { ok: false, status: 503, error: "photo storage is not configured" };

  const stored = await rows("select=id&limit=1", { headers: { Prefer: "count=exact", Range: "0-0" } });
  if (!stored) return { ok: false, status: 502, error: "photo storage is not reachable" };
  if ((stored.count ?? 0) >= MAX_STORED_PHOTOS) {
    return { ok: false, status: 507, error: "photo storage is full for this demo" };
  }

  const id = randomUUID();
  const path = photoPath(meta.runId, meta.stopId, meta.kind, id);
  try {
    const up = await fetch(`${c.url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...auth(c.key), "Content-Type": "image/jpeg", "x-upsert": "false" },
      body: bytes as unknown as BodyInit,
      signal: AbortSignal.timeout(30_000),
    });
    if (!up.ok) return { ok: false, status: 502, error: `storage returned ${up.status}` };
  } catch {
    return { ok: false, status: 502, error: "photo storage is not reachable" };
  }

  const insert = await rows("select=id", {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      id,
      run_id: meta.runId,
      stop_id: meta.stopId,
      asset_id: meta.assetId,
      crew_id: meta.crewId,
      kind: meta.kind,
      path,
      bytes: bytes.length,
      expires_at: meta.expiresAt,
    }),
  });
  if (!insert) {
    await removeObjects([path]); // no row, no orphan file
    return { ok: false, status: 502, error: "could not record the photo" };
  }
  return { ok: true, id };
}

// Removes photos whose expires_at has passed (public demo uploads). Returns how many were removed.
export async function deleteExpired(): Promise<number> {
  const due = await rows(`select=id,path&expires_at=lt.${encodeURIComponent(new Date().toISOString())}&limit=200`);
  if (!due || due.data.length === 0) return 0;
  if (!(await removeObjects(due.data.map((r) => r.path)))) return 0; // keep rows so the next run retries
  const ids = due.data.map((r) => r.id).join(",");
  await rows(`id=in.(${ids})`, { method: "DELETE" });
  return due.data.length;
}

export async function listBeforePhotos(): Promise<PhotoRow[] | null> {
  const res = await rows(`select=${COLUMNS}&kind=eq.before&order=created_at.desc&limit=100`);
  return res ? res.data : null;
}

async function oneRow(id: string): Promise<PhotoRow | null> {
  const res = await rows(`select=${COLUMNS}&id=eq.${id}&limit=1`);
  return res?.data[0] ?? null;
}

export async function readPhoto(id: string): Promise<Buffer | null> {
  const c = config();
  const row = c && isUuid(id) ? await oneRow(id) : null;
  if (!c || !row) return null;
  try {
    const res = await fetch(`${c.url}/storage/v1/object/${BUCKET}/${row.path}`, {
      headers: auth(c.key),
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch {
    return null;
  }
}

export async function confirmPhoto(id: string, level: number, suggested: number | null): Promise<boolean> {
  if (!isUuid(id)) return false;
  const res = await rows(`id=eq.${id}&select=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      confirmed_level: level,
      suggested_level: suggested,
      confirmed_at: new Date().toISOString(),
    }),
  });
  return !!res && res.data.length === 1;
}

// Deletes the file, the row and with it the label.
export async function deletePhoto(id: string): Promise<boolean> {
  const row = isUuid(id) ? await oneRow(id) : null;
  if (!row) return false;
  if (!(await removeObjects([row.path]))) return false;
  const res = await rows(`id=eq.${id}&select=id`, { method: "DELETE", headers: { Prefer: "return=representation" } });
  return !!res;
}
