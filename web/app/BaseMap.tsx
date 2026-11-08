"use client";

import { useEffect, useRef, useState } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import { BOUNDS, MAP_W } from "@/lib/geo";

// Real basemap (OpenFreeMap tiles, OpenStreetMap data) behind the SVG overlay. Not interactive: the overlay
// uses fixed map units (800 x 500) that match BOUNDS, so the view must never pan or zoom.
const STYLE = "https://tiles.openfreemap.org/styles/positron";

// Where the overlay sits now, in screen pixels: translate and scale (pixels per map unit), plus the box size.
export type View = { tx: number; ty: number; s: number; w: number; h: number };

export default function BaseMap({ onView }: { onView: (v: View) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const onViewRef = useRef(onView);
  useEffect(() => {
    onViewRef.current = onView;
  });
  const homeRef = useRef<View | null>(null);
  const [failed, setFailed] = useState(false);
  const [moved, setMoved] = useState(false);

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
        maxBounds: BOUNDS,
        maxZoom: 17,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
        fadeDuration: 0,
      });
      m.touchZoomRotate.disableRotation();
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      const fit = () => {
        m.setMinZoom(0);
        m.fitBounds(BOUNDS, { padding: 0, animate: false });
        m.setMinZoom(m.getZoom()); // cannot zoom out past the whole area
        homeRef.current = read();
      };
      const read = (): View | null => {
        const c = m.getContainer();
        const w = c.clientWidth;
        const h = c.clientHeight;
        if (!w || !h) return null;
        const p0 = m.project([BOUNDS[0][0], BOUNDS[1][1]]); // north-west corner
        const p1 = m.project([BOUNDS[1][0], BOUNDS[0][1]]); // south-east corner
        return { tx: p0.x, ty: p0.y, s: (p1.x - p0.x) / MAP_W, w, h };
      };
      const sync = () => {
        const v = read();
        if (!v) return;
        onViewRef.current(v);
        const home = homeRef.current;
        setMoved(
          !home || Math.abs(v.s / home.s - 1) > 0.01 || Math.abs(v.tx - home.tx) > 3 || Math.abs(v.ty - home.ty) > 3,
        );
      };
      m.on("resize", () => {
        fit();
        sync();
      });
      m.on("load", () => {
        fit();
        sync();
      });
      m.on("move", sync);
      m.on("error", () => setFailed(true));
      m.on("idle", () => setFailed(false));
      map = m;
      mapRef.current = m;
    })();
    return () => {
      dead = true;
      map?.remove();
    };
  }, []);

  return (
    <>
      <div ref={host} aria-hidden="true" style={{ position: "absolute", inset: 0 }} />
      {moved && (
        <button
          type="button"
          className="fr-btn fr-sec"
          onClick={() => mapRef.current?.fitBounds(BOUNDS, { padding: 0 })}
          style={{ position: "absolute", right: 56, bottom: 10, minHeight: 40, zIndex: 10 }}
        >
          Reset view
        </button>
      )}
      {failed && (
        <div
          role="status"
          style={{
            position: "absolute",
            left: 10,
            bottom: moved ? 58 : 10,
            zIndex: 10,
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
