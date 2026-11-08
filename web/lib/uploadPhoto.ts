// Browser side of the crew photo upload (ticket 16).
// Photos are re-encoded as a small JPEG before they leave the phone. That keeps uploads fast and
// drops EXIF data such as GPS and device details. The server checks everything again.

// Off by default so a plain local run keeps photos in memory only, as before.
export const PHOTO_UPLOAD_ON = process.env.NEXT_PUBLIC_PHOTO_UPLOAD === "1";
export const IS_PUBLIC_DEMO = process.env.NEXT_PUBLIC_PUBLIC_BUILD === "1";

const MAX_SIDE = 1280;

export async function toSmallJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas is not available");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  if (!blob) throw new Error("could not make a JPEG");
  return blob;
}

export type PhotoMeta = { runId: string; stopId: string; assetId: string; crewId: string };

async function uploadOne(kind: "before" | "after", file: File, meta: PhotoMeta): Promise<boolean> {
  try {
    const form = new FormData();
    form.set("file", await toSmallJpeg(file), `${kind}.jpg`);
    form.set("kind", kind);
    for (const [k, v] of Object.entries(meta)) form.set(k, v);
    const res = await fetch("/api/photos", { method: "POST", body: form });
    return res.ok;
  } catch {
    return false;
  }
}

// Uploads both photos of a job. Resolves to true only if both were saved.
export async function uploadJobPhotos(files: { before?: File; after?: File }, meta: PhotoMeta): Promise<boolean> {
  if (!files.before || !files.after) return false;
  const results = await Promise.all([uploadOne("before", files.before, meta), uploadOne("after", files.after, meta)]);
  return results.every(Boolean);
}
