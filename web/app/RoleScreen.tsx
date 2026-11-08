import Image from "next/image";
import RoomChip from "./RoomChip";

const FACE = (
  <>
    <circle r="19" fill="#FFE0C2" stroke="#0B2233" strokeWidth="3" />
    <circle cx="-6" cy="2" r="2.4" fill="#0B2233" />
    <circle cx="6" cy="2" r="2.4" fill="#0B2233" />
    <path d="M-5 9 q5 5 10 0" fill="none" stroke="#0B2233" strokeWidth="2.4" strokeLinecap="round" />
  </>
);

export default function RoleScreen({
  onManager,
  onCrew,
  onSplit,
}: {
  onManager: () => void;
  onCrew: () => void;
  onSplit: () => void;
}) {
  return (
    <div
      className="fr-role"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 20,
        background: "radial-gradient(circle at 20% 15%, #14506F 0%, #0B2233 55%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: "32px 20px",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 720 }}>
        <Image
          className="fr-rolemascot"
          src="/brand-mascot.png"
          alt=""
          width={110}
          height={95}
          unoptimized
          style={{ margin: "0 auto" }}
        />
        <h1 style={{ margin: "8px 0 6px" }}>
          <Image
            src="/brand-wordmark.png"
            alt="DrainWise"
            width={260}
            height={59}
            unoptimized
            style={{ margin: "0 auto" }}
          />
        </h1>
        <p style={{ margin: "0 0 8px", fontSize: 20, color: "#EAF6FB" }}>Clean the right drains before they block.</p>
        <p className="fr-intro" style={{ margin: 0, fontSize: 16, lineHeight: 1.5, color: "#B9D6E3" }}>
          Leaves block gross pollutant traps (GPTs), and most of them have no camera. DrainWise predicts which ones are
          about to block and tells crews where to go first. Crews fill the truck on one run, and every job is closed
          with proof: a camera check or before and after photos. Pick a role to start. No sign-in needed.
        </p>
      </div>
      <div
        className="fr-cards"
        style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center", maxWidth: 1000 }}
      >
        <button type="button" className="fr-card" onClick={onManager}>
          <svg width="64" height="64" viewBox="-24 -24 48 48" aria-hidden="true">
            {FACE}
            <circle cx="-11" cy="8" r="3" fill="#FFB38A" />
            <circle cx="11" cy="8" r="3" fill="#FFB38A" />
            <path d="M-19 -2 a19 18 0 0 1 38 0 q-19 -8 -38 0Z" fill="#4FC3E8" stroke="#0B2233" strokeWidth="2.5" />
          </svg>
          <span className="fr-ct">Manager</span>
          <span className="fr-cd">See risk across the whole map and send crews.</span>
        </button>
        <button type="button" className="fr-card" onClick={onCrew}>
          <svg width="64" height="64" viewBox="-24 -24 48 48" aria-hidden="true">
            {FACE}
            <circle cx="-11" cy="8" r="3" fill="#FFB38A" />
            <circle cx="11" cy="8" r="3" fill="#FFB38A" />
            <path
              d="M-19 -3 a19 17 0 0 1 38 0 Z"
              fill="#FF8A4C"
              stroke="#0B2233"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <rect x="-22" y="-4" width="44" height="6" rx="3" fill="#FF8A4C" stroke="#0B2233" strokeWidth="2" />
          </svg>
          <span className="fr-ct">Crew (phone)</span>
          <span className="fr-cd">Get a run, photograph before and after, mark each stop cleaned.</span>
        </button>
        <button type="button" className="fr-card fr-cardhi" onClick={onSplit}>
          <svg width="96" height="48" viewBox="0 0 96 48" aria-hidden="true">
            <g transform="translate(24,24)">
              {FACE}
              <path d="M-19 -3 a19 17 0 0 1 38 0 Z" fill="#FFD27A" stroke="#0B2233" strokeWidth="2.5" />
            </g>
            <g transform="translate(66,24)">
              {FACE}
              <path d="M-19 -3 a19 17 0 0 1 38 0 Z" fill="#7ED9A3" stroke="#0B2233" strokeWidth="2.5" />
            </g>
          </svg>
          <span className="fr-ct">Side-by-side demo</span>
          <span className="fr-cd">Manager map and crew phone together. Best for judges.</span>
        </button>
      </div>
      <RoomChip />
      <p style={{ margin: 0, fontSize: 14, color: "#B9D6E3", maxWidth: "60ch", textAlign: "center" }}>
        Sample data only. Real deployment would use council single sign-on and audit logs.
      </p>
    </div>
  );
}
