// Rules for a crew photo upload (ticket 16). Pure, so they are easy to test.
// The browser re-encodes every photo as a small JPEG first (this also drops EXIF such as GPS).
// The server still checks everything again, because anyone can call the route directly.

export const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
export const PUBLIC_PHOTO_TTL_HOURS = 24;
export const MAX_STORED_PHOTOS = 300; // keeps the free 1 GB Storage plan safe
export const PHOTO_KINDS = ["before", "after"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];

export type UploadCheck = { ok: true } | { ok: false; status: 400 | 413 | 415; error: string };

// JPEG files start with FF D8 FF. The declared content type alone is not trusted.
export function checkPhotoBytes(bytes: Uint8Array): UploadCheck {
  if (bytes.length === 0) return { ok: false, status: 400, error: "empty file" };
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, status: 413, error: "photo is larger than 3 MB" };
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isJpeg) return { ok: false, status: 415, error: "only JPEG photos are accepted" };
  return { ok: true };
}

// Ids end up in a storage path, so only a safe character set is allowed.
export function cleanId(raw: unknown): string | null {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(raw) ? raw : null;
}

export function parseKind(raw: unknown): PhotoKind | null {
  return raw === "before" || raw === "after" ? raw : null;
}

// Photos from the public demo are removed after a day. Local ones have no expiry (the owner deletes them).
export function expiryFor(nowMs: number, isPublicBuild: boolean): string | null {
  return isPublicBuild ? new Date(nowMs + PUBLIC_PHOTO_TTL_HOURS * 3600_000).toISOString() : null;
}

export function photoPath(runId: string, stopId: string, kind: PhotoKind, uuid: string): string {
  return `${runId}/${stopId}/${kind}-${uuid}.jpg`;
}

// Best-effort limit per client. In a serverless host each instance has its own memory, so this slows
// down casual abuse only; the real cap is MAX_STORED_PHOTOS.
export function allowRequest(hits: Map<string, number[]>, key: string, nowMs: number, limit = 30, windowMs = 3600_000) {
  const recent = (hits.get(key) ?? []).filter((t) => nowMs - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(nowMs);
  hits.set(key, recent);
  return true;
}
