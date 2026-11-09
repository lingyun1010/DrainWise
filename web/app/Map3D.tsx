"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { ROADS, heightAt, waterLevel, wx, wz } from "@/lib/terrain";
import type { Level, MapAsset, MapCrew } from "./MapView";

type Props = {
  assets: MapAsset[];
  crews: MapCrew[];
  rainMmH: number;
  extra: number;
  onOpen: (id: string) => void;
};

const TIER: Record<Level, string> = { high: "High", medium: "Medium", low: "Low" };

function canvasTex(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Drop mascot, same faces as the 2D map: frowning = High, neutral = Medium, smiling = Low.
function dropTex(level: Level, state: MapAsset["state"]) {
  const busy = state === "busy";
  const done = state === "done";
  const fill = done || level === "low" ? "#4FC3E8" : level === "high" ? "#FF8A4C" : "#FFD27A";
  return canvasTex(128, (ctx, s) => {
    const k = s / 128;
    ctx.scale(k, k);
    ctx.translate(64, 70);
    ctx.beginPath();
    ctx.moveTo(0, -56);
    ctx.bezierCurveTo(24, -28, 42, -8, 42, 16);
    ctx.arc(0, 16, 42, 0, Math.PI, false);
    ctx.bezierCurveTo(-42, -8, -24, -28, 0, -56);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = "#FFF3EA";
    ctx.stroke();
    const ink = level === "high" && !done ? "#2A1208" : "#0B2233";
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(-14, 10, 6.5, 0, 7);
    ctx.arc(14, 10, 6.5, 0, 7);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    if (done || level === "low") {
      ctx.moveTo(-12, 26);
      ctx.quadraticCurveTo(0, 40, 12, 26);
    } else if (level === "high") {
      ctx.moveTo(-10, 36);
      ctx.quadraticCurveTo(0, 24, 10, 36);
    } else {
      ctx.moveTo(-8, 32);
      ctx.lineTo(8, 32);
    }
    ctx.stroke();
    if (busy || done) {
      ctx.beginPath();
      ctx.arc(34, -36, 20, 0, 7);
      ctx.fillStyle = done ? "#fff" : "#FFD27A";
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#0B2233";
      ctx.stroke();
      ctx.fillStyle = "#0B2233";
      ctx.font = "800 26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(done ? "✓" : "…", 34, -27);
    }
  });
}

function crewTex(c: MapCrew) {
  return canvasTex(96, (ctx, s) => {
    const k = s / 96;
    ctx.scale(k, k);
    ctx.translate(48, 52);
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, 7);
    ctx.fillStyle = "#FFE0C2";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#0B2233";
    ctx.stroke();
    ctx.fillStyle = "#0B2233";
    ctx.beginPath();
    ctx.arc(-9, 3, 3.5, 0, 7);
    ctx.arc(9, 3, 3.5, 0, 7);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-7, 13);
    ctx.quadraticCurveTo(0, 20, 7, 13);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-30, -4);
    ctx.arc(0, -4, 30, Math.PI, 0);
    ctx.closePath();
    ctx.fillStyle = c.hat;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillRect(-36, -6, 72, 10);
    ctx.strokeRect(-36, -6, 72, 10);
    ctx.beginPath();
    ctx.arc(26, 28, 14, 0, 7);
    ctx.fillStyle = "#0B2233";
    ctx.fill();
    ctx.fillStyle = "#EAF6FB";
    ctx.font = "800 18px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(c.letter, 26, 34);
  });
}

export default function Map3D({ assets, crews, rainMmH, extra, onOpen }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  // Latest props, read inside the render loop so the scene is built once.
  const live = useRef({ assets, crews, rainMmH, extra, onOpen });
  useEffect(() => {
    live.current = { assets, crews, rainMmH, extra, onOpen };
  });
  const [stats, setStats] = useState({ level: 0, reached: 0, reachedHigh: 0 });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- WebGL support is only known in the browser
      setFailed(true);
      return;
    }
    const W = host.clientWidth || 800;
    const H = Math.round(W * 0.625);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H);
    const el = renderer.domElement;
    el.style.cssText = "display:block;width:100%;height:auto;touch-action:none;cursor:grab";
    el.setAttribute("role", "img");
    el.setAttribute(
      "aria-label",
      "3D view of sample terrain with a rising water level and GPT markers. Drag to rotate, scroll to zoom. Illustration only, not a flood forecast.",
    );
    host.appendChild(el);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x12384f);
    scene.fog = new THREE.Fog(0x12384f, 90, 170);
    const cam = new THREE.PerspectiveCamera(45, W / H, 0.5, 400);
    scene.add(new THREE.AmbientLight(0xbfe3f2, 1.6));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.6);
    sun.position.set(-30, 60, 20);
    scene.add(sun);

    // Terrain
    const g = new THREE.PlaneGeometry(84, 54, 126, 81);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const c1 = new THREE.Color(0x2f8fb5);
    const c2 = new THREE.Color(0x3c7d6b);
    const c3 = new THREE.Color(0x9cb58a);
    const tmp = new THREE.Color();
    for (let v = 0; v < pos.count; v++) {
      const h = heightAt(pos.getX(v), pos.getZ(v));
      pos.setY(v, h);
      const t = Math.min(1, h / 3.2);
      if (t < 0.4) tmp.copy(c1).lerp(c2, t / 0.4);
      else tmp.copy(c2).lerp(c3, (t - 0.4) / 0.6);
      cols[v * 3] = tmp.r;
      cols[v * 3 + 1] = tmp.g;
      cols[v * 3 + 2] = tmp.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    scene.add(
      new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.93 })),
    );

    // Roads and the drain pipes under them
    const roadMat = new THREE.LineBasicMaterial({ color: 0xe8f3f7, transparent: true, opacity: 0.5 });
    const pipeMat = new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.6, depthTest: false });
    ROADS.forEach((r) => {
      const rp: THREE.Vector3[] = [];
      const pp: THREE.Vector3[] = [];
      for (let i = 0; i <= 70; i++) {
        const f = i / 70;
        const x = wx(r[0] + (r[2] - r[0]) * f);
        const z = wz(r[1] + (r[3] - r[1]) * f);
        const h = heightAt(x, z);
        rp.push(new THREE.Vector3(x, h + 0.06, z));
        pp.push(new THREE.Vector3(x, h - 0.25, z));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rp), roadMat));
      const pl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pp), pipeMat);
      pl.renderOrder = 2;
      scene.add(pl);
    });

    // Water plane
    const wg = new THREE.PlaneGeometry(84, 54);
    wg.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(
      wg,
      new THREE.MeshPhongMaterial({
        color: 0x4fc3e8,
        transparent: true,
        opacity: 0.62,
        shininess: 90,
        specular: 0xcfefff,
      }),
    );
    scene.add(water);

    // Sprites. Textures are cached per level/state/type.
    const texCache = new Map<string, THREE.Texture>();
    const texFor = (a: MapAsset) => {
      const key = `${a.type}-${a.level}-${a.state}`;
      let t = texCache.get(key);
      if (!t) {
        t = dropTex(a.level, a.state);
        texCache.set(key, t);
      }
      return t;
    };
    type AssetSprite = THREE.Sprite & { userData: { id: string; key: string } };
    const dropSprites = new Map<string, AssetSprite>();
    const crewSprites = new Map<string, THREE.Sprite>();
    const crewTexCache = new Map<string, THREE.Texture>();

    // Camera orbit (drag) and zoom (wheel)
    let az = 0.35;
    let po = 0.95;
    let rad = 64;
    let dn: { x: number; y: number } | null = null;
    let moved = 0;
    const placeCam = () => {
      cam.position.set(rad * Math.sin(po) * Math.sin(az), rad * Math.cos(po), rad * Math.sin(po) * Math.cos(az));
      cam.lookAt(0, 1, 0);
    };
    const onDown = (e: PointerEvent) => {
      dn = { x: e.clientX, y: e.clientY };
      moved = 0;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!dn) return;
      const dx = e.clientX - dn.x;
      const dy = e.clientY - dn.y;
      moved += Math.abs(dx) + Math.abs(dy);
      dn = { x: e.clientX, y: e.clientY };
      az -= dx * 0.006;
      po = Math.max(0.35, Math.min(1.3, po - dy * 0.005));
    };
    const onUp = (e: PointerEvent) => {
      el.style.cursor = "grab";
      if (moved < 6) {
        const r = el.getBoundingClientRect();
        const m = new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1,
        );
        const rc = new THREE.Raycaster();
        rc.setFromCamera(m, cam);
        const hit = rc.intersectObjects([...dropSprites.values()])[0];
        if (hit) live.current.onOpen((hit.object as AssetSprite).userData.id);
      }
      dn = null;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      rad = Math.max(28, Math.min(100, rad + e.deltaY * 0.04));
    };
    // Keyboard: arrows rotate, +/- zoom (the canvas is focusable).
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      if (k === "ArrowLeft") az += 0.1;
      else if (k === "ArrowRight") az -= 0.1;
      else if (k === "ArrowUp") po = Math.max(0.35, po - 0.06);
      else if (k === "ArrowDown") po = Math.min(1.3, po + 0.06);
      else if (k === "+" || k === "=") rad = Math.max(28, rad - 6);
      else if (k === "-") rad = Math.min(100, rad + 6);
      else return;
      e.preventDefault();
    };
    el.tabIndex = 0;
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("keydown", onKey);

    const resize = () => {
      const w = host.clientWidth;
      if (!w) return;
      renderer.setSize(w, Math.round(w * 0.625));
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let L = waterLevel(live.current.rainMmH, live.current.extra);
    let tm = 0;
    let raf = 0;
    let lastStats = "";
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const { assets: as, crews: cs, rainMmH: rain, extra: ex } = live.current;
      tm += reduced ? 0 : 0.03;
      const target = waterLevel(rain, ex);
      L = reduced ? target : L + (target - L) * 0.03;
      water.position.y = L;
      water.material.opacity = 0.55 + 0.08 * Math.sin(tm);

      let reached = 0;
      let reachedHigh = 0;
      const seen = new Set<string>();
      as.forEach((a) => {
        seen.add(a.id);
        let sp = dropSprites.get(a.id);
        if (!sp) {
          sp = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: texFor(a), depthTest: false, transparent: true }),
          ) as AssetSprite;
          sp.renderOrder = 10;
          sp.userData = { id: a.id, key: "" };
          scene.add(sp);
          dropSprites.set(a.id, sp);
        }
        const x = wx(a.x);
        const z = wz(a.y);
        const h = heightAt(x, z);
        const key = `${a.type}-${a.level}-${a.state}`;
        if (sp.userData.key !== key) {
          sp.userData.key = key;
          sp.material.map = texFor(a);
          sp.material.needsUpdate = true;
        }
        if (L > h + 0.1) {
          reached++;
          if (a.level === "high" && a.state !== "done") reachedHigh++;
        }
        const base = a.level === "high" ? 4.2 : a.level === "medium" ? 3.2 : 2.4;
        const pulse = a.level === "high" && a.state === "idle" ? 1 + 0.12 * Math.sin(tm * 3) : 1;
        sp.scale.set(base * pulse, base * pulse, 1);
        sp.position.set(x, h + 0.8 + base * 0.5 + 0.15 * Math.sin(tm * 2 + a.x), z);
      });
      dropSprites.forEach((sp, id) => {
        if (!seen.has(id)) {
          scene.remove(sp);
          dropSprites.delete(id);
        }
      });

      cs.forEach((c) => {
        let sp = crewSprites.get(c.name);
        if (!sp) {
          let t = crewTexCache.get(c.name);
          if (!t) {
            t = crewTex(c);
            crewTexCache.set(c.name, t);
          }
          sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
          sp.scale.set(3.4, 3.4, 1);
          sp.renderOrder = 11;
          scene.add(sp);
          crewSprites.set(c.name, sp);
        }
        const x = wx(c.x);
        const z = wz(c.y);
        sp.position.set(x, heightAt(x, z) + 1.9 + (c.working ? 0.15 * Math.sin(tm * 8) : 0), z);
      });

      const s = `${L.toFixed(2)}|${reached}|${reachedHigh}`;
      if (s !== lastStats) {
        lastStats = s;
        setStats({ level: L, reached, reachedHigh });
      }
      placeCam();
      renderer.render(scene, cam);
    };
    placeCam();
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKey);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      texCache.forEach((t) => t.dispose());
      crewTexCache.forEach((t) => t.dispose());
      renderer.dispose();
      el.remove();
    };
  }, []);

  if (failed) {
    return (
      <div role="alert" style={{ background: "#3A1A12", border: "2px solid #FF8A4C", borderRadius: 14, padding: 16 }}>
        3D view needs WebGL, which is not available in this browser. Switch back to the 2D map.
      </div>
    );
  }

  const highCount = assets.filter((a) => a.level === "high" && a.state !== "done").length;
  return (
    <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", border: "2px solid #2D6182" }}>
      <div ref={hostRef} />
      <div
        style={{
          position: "absolute",
          left: 14,
          bottom: 14,
          right: 14,
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div className="fr-tile" style={{ background: "#102F45" }}>
          <div>WATER LEVEL (SAMPLE)</div>
          <div>{stats.level.toFixed(1)} m</div>
        </div>
        <div className="fr-tile" style={{ background: "#102F45" }}>
          <div>ASSETS REACHED</div>
          <div>
            {stats.reached} of {assets.length}
          </div>
        </div>
        <div className="fr-tile" style={{ background: "#102F45" }}>
          <div>{TIER.high.toUpperCase()} RISK REACHED</div>
          <div>
            {stats.reachedHigh} of {highCount}
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#B9D6E3",
            background: "#102F45cc",
            borderRadius: 999,
            padding: "4px 12px",
          }}
        >
          Illustration on sample terrain, not a flood forecast. Drag to rotate, scroll to zoom.
        </div>
      </div>
    </div>
  );
}
