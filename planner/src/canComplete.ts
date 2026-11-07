export type Photos = { before?: string; after?: string };
export type Completion = { ok: boolean; missing: ("before" | "after")[] };

export function canComplete(site: { hasCamera: boolean }, photos: Photos): Completion {
  if (site.hasCamera) return { ok: true, missing: [] };
  const missing: Completion["missing"] = [];
  if (!photos.before) missing.push("before");
  if (!photos.after) missing.push("after");
  return { ok: missing.length === 0, missing };
}
