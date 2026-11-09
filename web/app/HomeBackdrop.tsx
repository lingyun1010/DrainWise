import type { CSSProperties } from "react";

/**
 * Decorative backdrop for the role screen: falling leaves, a warm glow, an original simplified Parramatta
 * skyline (hand-drawn shapes, matches reference/drainwise-home-prototype.html) and a slow water strip. Pure CSS animation (see `.fr-bg` in globals.css), no dependencies.
 * Everything is aria-hidden and is switched off by prefers-reduced-motion.
 *
 * Leaf values come from a tiny deterministic hash, not Math.random, so server and client render the same.
 */

const LEAF_COUNT = 22; // phones show the first 12 (CSS)
const LEAF_COLOURS = ["#ff8a3d", "#f2a33a", "#e8651f", "#ffc857", "#c8501a", "#f7b267"];

function rnd(i: number, k: number, min: number, max: number): number {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  const f = x - Math.floor(x);
  return Math.round((min + f * (max - min)) * 100) / 100;
}

const LEAVES = Array.from({ length: LEAF_COUNT }, (_, i) => {
  const spin = rnd(i, 7, 90, 300);
  return {
    colour: LEAF_COLOURS[i % LEAF_COLOURS.length],
    style: {
      "--x": `${rnd(i, 1, 0, 98)}%`,
      "--s": `${rnd(i, 2, 14, 30)}px`,
      "--o": rnd(i, 3, 0.55, 0.95),
      "--fd": `${rnd(i, 4, 10, 19)}s`,
      "--fl": `${-rnd(i, 5, 0, 19)}s`,
      "--sw": `${rnd(i, 6, 14, 40)}px`,
      "--sd": `${rnd(i, 8, 2.5, 5)}s`,
      "--sl": `${-rnd(i, 9, 0, 5)}s`,
      "--r0": `${-spin / 2}deg`,
      "--r1": `${spin / 2}deg`,
      "--rd": `${rnd(i, 10, 3, 7)}s`,
    } as CSSProperties,
  };
});

// Window lights on the towers (x, y in the 1440 x 260 skyline box).
const WINDOWS: [number, number][] = [
  [716, 98],
  [732, 98],
  [716, 132],
  [748, 132],
  [732, 166],
  [800, 62],
  [816, 62],
  [800, 96],
  [832, 96],
  [816, 130],
  [800, 164],
  [832, 164],
  [884, 118],
  [900, 118],
  [884, 152],
  [916, 152],
  [900, 186],
  [950, 150],
  [966, 150],
  [950, 184],
  [982, 184],
];

export default function HomeBackdrop() {
  return (
    <div className="fr-bg" aria-hidden="true">
      <div className="fr-glow" />
      <div className="fr-sky fr-sky-wide">
        <svg viewBox="0 0 1440 260" preserveAspectRatio="xMidYMax slice" focusable="false">
          <g fill="#0a2236" opacity=".95">
            {/* ground, filler blocks */}
            <rect x="0" y="214" width="1440" height="46" />
            <rect x="420" y="196" width="60" height="64" />
            <rect x="1010" y="190" width="40" height="70" />
            <rect x="1060" y="204" width="50" height="56" />
            {/* Western Sydney Stadium roof */}
            <path d="M40 214 Q40 160 190 150 Q340 160 340 214 Z" />
            <rect x="52" y="210" width="276" height="50" />
            {/* Old Government House */}
            <rect x="380" y="186" width="180" height="74" />
            <path d="M440 186 L470 158 L500 186 Z" />
            <rect x="372" y="180" width="196" height="8" />
            {/* Town Hall clock tower */}
            <rect x="596" y="116" width="48" height="144" />
            <rect x="590" y="108" width="60" height="10" />
            <path d="M598 108 L620 46 L642 108 Z" />
            <rect x="618" y="30" width="4" height="20" />
            {/* Parramatta Square towers */}
            <rect x="700" y="84" width="64" height="176" />
            <rect x="780" y="40" width="72" height="220" />
            <rect x="866" y="100" width="68" height="160" />
            <rect x="944" y="132" width="56" height="128" />
            {/* stone arch bridge */}
            <path d="M1040 260 V206 H1420 V260 H1390 A25 28 0 0 0 1340 260 H1310 A25 28 0 0 0 1260 260 H1230 A25 28 0 0 0 1180 260 H1150 A25 28 0 0 0 1100 260 H1070 Z" />
          </g>
          <g stroke="#10405c" strokeWidth="4" fill="none" strokeLinecap="round">
            <path d="M70 206 Q190 168 310 206" />
            <path d="M120 130 V200 M260 130 V200" />
          </g>
          <g fill="#10405c">
            <rect x="468" y="164" width="14" height="12" />
            <rect x="394" y="204" width="8" height="40" />
            <rect x="420" y="204" width="8" height="40" />
            <rect x="446" y="204" width="8" height="40" />
            <rect x="486" y="204" width="8" height="40" />
            <rect x="512" y="204" width="8" height="40" />
            <rect x="538" y="204" width="8" height="40" />
          </g>
          <circle cx="620" cy="142" r="12" fill="#ffb066" />
          <g fill="#ffcf8a" opacity=".75">
            {WINDOWS.map(([x, y]) => (
              <rect key={`${x}-${y}`} x={x} y={y} width="6" height="8" rx="1" />
            ))}
          </g>
          <path d="M1060 206 Q1200 170 1400 206" fill="none" stroke="#10405c" strokeWidth="5" />
        </svg>
      </div>
      <div className="fr-sky fr-sky-phone">
        <svg viewBox="0 0 430 230" preserveAspectRatio="xMidYMax slice" focusable="false">
          <g fill="#0a2236" opacity=".95">
            <path d="M0 200 Q40 150 90 168 L90 200Z" />
            <rect x="0" y="196" width="92" height="34" />
            <rect x="104" y="170" width="70" height="30" />
            <path d="M104 170 L139 150 L174 170Z" />
            <rect x="132" y="158" width="14" height="12" fill="#10405c" />
            <rect x="190" y="128" width="26" height="102" />
            <path d="M190 128 L203 96 L216 128Z" />
            <circle cx="203" cy="146" r="7" fill="#ffb066" />
            <rect x="232" y="70" width="34" height="160" />
            <rect x="270" y="40" width="40" height="190" />
            <rect x="314" y="92" width="30" height="138" />
            <rect x="348" y="124" width="26" height="106" />
            <rect x="378" y="150" width="52" height="80" />
            <path d="M0 214 H430 V230 H0Z" />
          </g>
          <g fill="#ffcf8a" opacity=".75">
            <rect x="238" y="84" width="4" height="5" />
            <rect x="250" y="102" width="4" height="5" />
            <rect x="278" y="58" width="4" height="5" />
            <rect x="292" y="80" width="4" height="5" />
            <rect x="280" y="112" width="4" height="5" />
            <rect x="322" y="108" width="4" height="5" />
            <rect x="354" y="138" width="4" height="5" />
            <rect x="244" y="130" width="4" height="5" />
            <rect x="298" y="140" width="4" height="5" />
          </g>
          <path d="M20 214 Q60 180 100 214" fill="none" stroke="#10405c" strokeWidth="5" />
        </svg>
      </div>
      <div className="fr-water">
        <i />
        <i />
        <i />
      </div>
      <div className="fr-leaves">
        {LEAVES.map((l, i) => (
          <span className="fr-leaf" style={l.style} key={i}>
            <span className="fr-leafsway">
              <svg viewBox="0 0 24 24" className="fr-leafspin" focusable="false">
                <path d="M12 1 C19 6 21 14 12 23 C3 14 5 6 12 1Z" fill={l.colour} />
                <path d="M12 5 V22" stroke="rgba(0,0,0,.25)" strokeWidth="1" />
              </svg>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
