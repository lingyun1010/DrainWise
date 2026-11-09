"use client";

import { useState } from "react";
import Dialog from "./Dialog";

// "How it works" (ticket 24): what the score means, what the planner does, what is simulated.
// Plain words, English, no emoji. Opens from a button; closes with Esc or Close.
export default function HowItWorks({ className = "fr-btn fr-ghost" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const h = { margin: "14px 0 4px", fontSize: 15, fontWeight: 700, color: "#EAF6FB" } as const;
  const p = { margin: "0 0 8px", fontSize: 14, lineHeight: 1.5, color: "#CFE6F0" } as const;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        How it works
      </button>
      {open && (
        <Dialog
          label="How DrainWise works"
          eyebrow="Sample data"
          title="How it works"
          maxWidth={560}
          onClose={() => setOpen(false)}
          actions={
            <button type="button" className="fr-btn fr-pri" onClick={() => setOpen(false)}>
              Close
            </button>
          }
        >
          <p style={p}>
            DrainWise looks at gross pollutant traps (GPTs), net type only, and suggests which ones to clean first.
            Everything on screen is sample data.
          </p>
          <h3 style={h}>What the score means</h3>
          <p style={p}>
            Each GPT gets a risk from the model: the chance it blocks soon. High (60%+), Medium (30%+) or Low. Every
            score lists its top reasons, such as tree cover or days since the last clean. It is not a fullness reading
            from a photo.
          </p>
          <h3 style={h}>What the planner does</h3>
          <ol style={{ ...p, paddingLeft: 24, listStyle: "decimal" }}>
            <li>Keeps only Medium and High risk GPTs.</li>
            <li>Estimates how much debris each one holds (a sample estimate).</li>
            <li>Picks the set with the most total risk that fits the truck capacity (3 m³ is an assumption).</li>
            <li>Orders the stops nearest-first from the depot.</li>
          </ol>
          <p style={p}>
            The result is a suggestion for the contractor, who picks the day and the people. The crew phone shows how a
            contractor&apos;s crew would work through it and close each job with proof.
          </p>
          <h3 style={h}>What is simulated</h3>
          <p style={p}>
            GPT positions, tree cover, cleaning history, the 7 camera sites, camera photos and load sizes are sample
            data. The model is trained on simulated history, not on council records. Rain since 9am and the rain
            forecast are real Bureau of Meteorology readings; the 3-hourly strip is sample.
          </p>
        </Dialog>
      )}
    </>
  );
}
