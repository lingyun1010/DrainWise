"use client";

// Row of crew buttons: colour dot plus name, pressed = shown. Used under the map and in the Activity log.
export default function CrewToggles({
  crews,
  hidden,
  onToggle,
  label,
  suffix,
}: {
  crews: { id: string; name: string; hat: string }[];
  hidden: string[];
  onToggle: (id: string) => void;
  label: string; // "Show on map:"
  suffix: string; // "on the map"
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {label}
      {crews.map((c) => {
        const shown = !hidden.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={shown}
            aria-label={`${c.name} ${suffix}`}
            onClick={() => onToggle(c.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 40,
              padding: "2px 8px",
              background: "transparent",
              border: 0,
              borderRadius: 999,
              color: shown ? "#EAF6FB" : "#8FB8CC",
              cursor: "pointer",
              font: "inherit",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background: shown ? c.hat : "transparent",
                border: `3px solid ${c.hat}`,
                flex: "none",
              }}
            />
            {c.name}
          </button>
        );
      })}
    </span>
  );
}
