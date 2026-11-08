"use client";

import { useEffect, useState } from "react";

type Reading = {
  asset_id: string;
  level: number;
  name: string;
  confidence: string;
  reason: string;
  image: string;
  thumb: string;
};

// Fetched from /api/camera/<GPT id>. Camera still plus the placeholder image-model reading for a GPT that has a camera (ticket 17).
// SAMPLE DATA: the still is one of 7 council sample photos, the level is a mock. No model runs when this opens.
// The photo is small first; click it to see it larger inside the same dialog (no navigation).
export default function CameraView({ assetId }: { assetId: string }) {
  const [big, setBig] = useState(false);
  const [r, setR] = useState<Reading | null>(null);
  const [failed, setFailed] = useState(false);
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
  if (failed) return <p style={{ margin: "0 0 12px" }}>Camera reading not available. The crew confirms on site.</p>;
  if (!r) return <p style={{ margin: "0 0 12px", color: "#8FB8CC" }}>Loading the camera reading (sample data)...</p>;
  const src = big ? r.image : r.thumb;
  return (
    <section aria-label="Camera view" style={{ margin: "0 0 12px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", color: "#8FD8F0", marginBottom: 6 }}>
        CAMERA VIEW · NO CREW PHOTOS NEEDED
      </div>
      <button
        type="button"
        onClick={() => setBig((b) => !b)}
        aria-expanded={big}
        aria-label={big ? "Show the camera still smaller" : "Show the camera still larger"}
        style={{
          display: "block",
          padding: 0,
          border: "2px solid #4FC3E8",
          borderRadius: 14,
          overflow: "hidden",
          background: "#0B2233",
          cursor: big ? "zoom-out" : "zoom-in",
          width: big ? "100%" : 240,
          maxWidth: "100%",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={`Sample camera still for ${assetId}`}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </button>
      <div style={{ fontSize: 13, color: "#8FB8CC", margin: "4px 0 8px" }}>
        Sample photo, not a live camera. {big ? "Click to make it smaller." : "Click to enlarge."}
      </div>
      <div style={{ fontWeight: 700, fontSize: 16 }}>
        Level {r.level} · {r.name}
      </div>
      <div>
        {r.reason} Confidence: {r.confidence}.
      </div>
      <div style={{ fontSize: 13, color: "#8FB8CC", marginTop: 4 }}>
        Mock placeholder, not read from the photo by a model. Prototype, no accuracy claim.
      </div>
    </section>
  );
}
