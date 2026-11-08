"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { BOUNDS } from "@/lib/geo";

// Real basemap (OpenFreeMap tiles, OpenStreetMap data) behind the SVG overlay. Not interactive: the overlay
// uses fixed map units (800 x 500) that match BOUNDS, so the view must never pan or zoom.
const STYLE = "https://tiles.openfreemap.org/styles/positron";

export default function BaseMap() {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    let dead = false;
    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (dead || !host.current) return;
      const m = new maplibregl.Map({
        container: host.current,
        style: STYLE,
        bounds: BOUNDS,
        fitBoundsOptions: { padding: 0, animate: false },
        interactive: false,
        attributionControl: false,
        fadeDuration: 0,
      });
      m.on("resize", () => m.fitBounds(BOUNDS, { padding: 0, animate: false }));
      m.on("error", () => setFailed(true));
      m.on("idle", () => setFailed(false));
      map = m;
    })();
    return () => {
      dead = true;
      map?.remove();
    };
  }, []);

  return (
    <>
      <div ref={host} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />
      {failed && (
        <div
          role="status"
          style={{
            position: "absolute",
            left: 10,
            bottom: 10,
            background: "#102F45",
            color: "#EAF6FB",
            border: "2px solid #1E4A63",
            borderRadius: 999,
            padding: "4px 12px",
            fontSize: 13,
          }}
        >
          Basemap not loaded. Creeks and markers still show.
        </div>
      )}
    </>
  );
}
