"use client";

import { useEffect, useState } from "react";
import { annotate } from "../../planner/src/annotateReading";
import type { ImageReading } from "../../planner/src/readImage";

type Reading = {
  asset_id: string;
  level: number;
  name: string;
  confidence: string;
  reason: string;
  image: string;
  synthetic_image: string;
  image_reading: { file: string; reading: ImageReading } | null;
  image_reading_meta: { image_size: { width: number; height: number } };
};

const DAMAGE_TEXT: Record<ImageReading["damage"], string> = {
  none: "No damage seen",
  net_full: "Net full (at or past 70%)",
  net_broken: "Net may be broken",
  net_fallen: "Net may have fallen off",
};

// Short label for the circled area (number 1 on the image). The numbers are written once, in the headline below.
const CAPTION: Record<ImageReading["damage"], string> = {
  none: "Changed area compared with the clean reference.",
  net_full: "Changed area compared with the clean reference.",
  net_broken: "Possible hole in the net.",
  net_fallen: "The net sits away from its usual spot.",
};

// Fetched from /api/camera/<GPT id>. Camera still plus the placeholder image-model reading for a GPT that has a camera (ticket 17).
// SAMPLE DATA: the still is one of 7 council sample photos, the level is a mock. No model runs when this opens.
// The photo is shown at full dialog width.
export default function CameraView({ assetId }: { assetId: string }) {
  const [r, setR] = useState<Reading | null>(null);
  const [failed, setFailed] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  // The synthetic image is committed in public/camera/synthetic. If it ever fails to load, fall back to the plain
  // council sample photo. No circle then: the circle marks the synthetic edit.
  const [plain, setPlain] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/camera/${encodeURIComponent(assetId)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((d: Reading) => live && setR(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [assetId]);
  if (failed)
    return (
      <p role="status" style={{ margin: "0 0 12px" }}>
        Camera reading not available. The crew confirms on site.
      </p>
    );
  if (!r)
    return (
      <p role="status" style={{ margin: "0 0 12px", color: "#8FB8CC" }}>
        Loading the camera reading (sample data)...
      </p>
    );
  const ir = r.image_reading?.reading;
  if (!ir) {
    return (
      <section aria-label="Camera view" style={{ margin: "0 0 12px" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          Mock blockage level {r.level} · {r.name}
        </div>
        <div style={{ fontSize: 13, color: "#8FB8CC", marginTop: 4 }}>
          Mock placeholder (sample data), not read from a photo. Prototype, no accuracy claim.
        </div>
      </section>
    );
  }
  const size = r.image_reading_meta.image_size;
  const a = plain ? null : annotate(ir, size);
  return (
    <section aria-label="Camera view" style={{ margin: "0 0 12px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", color: "#8FD8F0", marginBottom: 6 }}>
        CAMERA VIEW · NO CREW PHOTOS NEEDED
      </div>
      {imgOk && (
        <div
          style={{
            position: "relative",
            border: "2px solid #4FC3E8",
            borderRadius: 14,
            overflow: "hidden",
            background: "#0B2233",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={plain ? r.image : r.synthetic_image}
            alt={
              plain
                ? `Council sample photo used as the camera image for ${assetId}`
                : `Synthetic camera image for ${assetId}${a ? ", with the changed area circled" : ""}`
            }
            onError={() => (plain ? setImgOk(false) : setPlain(true))}
            style={{ display: "block", width: "100%", height: "auto" }}
          />
          {a && (
            <svg
              viewBox={`0 0 ${size.width} ${size.height}`}
              aria-hidden="true"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
              <defs>
                <marker id="cv-head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" fill="#FFFFFF" />
                </marker>
              </defs>
              <circle cx={a.circle.cx} cy={a.circle.cy} r={a.circle.r} fill="none" stroke="#FFFFFF" strokeWidth={9} />
              <circle
                cx={a.circle.cx}
                cy={a.circle.cy}
                r={a.circle.r}
                fill="none"
                stroke="#0B2233"
                strokeWidth={4}
                strokeDasharray="10 8"
              />
              <line
                x1={a.arrow.x1}
                y1={a.arrow.y1}
                x2={a.arrow.x2}
                y2={a.arrow.y2}
                stroke="#FFFFFF"
                strokeWidth={9}
                markerEnd="url(#cv-head)"
              />
              <circle cx={a.arrow.x1} cy={a.arrow.y1} r={34} fill="#FFFFFF" />
              <text
                x={a.arrow.x1}
                y={a.arrow.y1 + 15}
                textAnchor="middle"
                fontSize={46}
                fontWeight={800}
                fill="#0B2233"
              >
                {a.caption.n}
              </text>
            </svg>
          )}
        </div>
      )}
      <div style={{ fontSize: 13, color: "#8FB8CC", margin: "4px 0 8px" }}>
        {plain
          ? "Council sample photo (sample data), not a live camera. The reading below is a mock."
          : "Synthetic image (sample data: an edit of a council sample photo), not a live camera."}
        {!imgOk && " The image is not available on this build; the reading is shown as text."}
      </div>
      <p style={{ margin: "0 0 8px" }}>
        {imgOk && a && <strong aria-hidden="true">1. </strong>}
        {!a ? "No change against the clean reference." : CAPTION[ir.damage]}
      </p>
      <div style={{ fontWeight: 700, fontSize: 16 }}>
        {ir.band === null
          ? `Net fullness not read (${ir.damage === "net_fallen" ? "net not in place" : "net may be damaged"})`
          : `Net ${ir.bandLabel} full${ir.needsCleaning ? ", at or past the 70% cleaning line" : ""}`}
      </div>
      <div>
        Confidence {Math.round(ir.confidence * 100)}%
        {ir.damage === "net_broken" || ir.damage === "net_fallen" ? `. ${DAMAGE_TEXT[ir.damage]}` : ""}
        {ir.unclear ? ". Unclear, a person should check" : ""}
      </div>
      <div style={{ fontSize: 13, color: "#8FB8CC", marginTop: 4 }}>
        A proxy from the changed area, not a measurement, and separate from High / Medium / Low risk. A person confirms
        it. Prototype, no accuracy claim.
      </div>
    </section>
  );
}
