"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Photos waiting for an admin (ticket 29). Polled like the shared team room; no email.
export type Unread = { id: string; at: string; assetId: string; crewId: string; runId: string };

export function useUnread(): Unread[] {
  const [items, setItems] = useState<Unread[]>([]);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const res = await fetch("/api/review/unread", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { items: Unread[] };
        if (live) setItems(data.items);
      } catch {
        /* offline or no storage: keep the last list */
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  return items;
}

// Stored crew ids look like "c1", "c2": the number is the crew position, so c1 is Crew A.
const crewName = (id: string) => {
  const m = id.match(/^c(\d+)$/i);
  return m ? `Crew ${String.fromCharCode(64 + Number(m[1]))}` : id;
};

export const itemText = (u: Unread) =>
  `New before photo, ${u.assetId}, ${crewName(u.crewId)}, ${new Date(u.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

export default function ReviewBell() {
  const items = useUnread();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div ref={box} style={{ position: "relative" }}>
      <button
        type="button"
        className="fr-btn fr-sec"
        style={{ minHeight: 40, padding: "6px 12px", gap: 8 }}
        aria-expanded={open}
        aria-label={`Photos to review: ${items.length}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden>Bell</span>
        <strong>{items.length}</strong>
      </button>
      {open && (
        <div
          role="region"
          aria-label="Photos to review"
          className="fr-tip"
          style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 300, zIndex: 50, opacity: 1 }}
        >
          <strong>Photos to review</strong>
          {items.length === 0 ? (
            <div style={{ color: "var(--fr-mute)", marginTop: 6 }}>Nothing waiting.</div>
          ) : (
            <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
              {items.slice(0, 8).map((u) => (
                <li key={u.id}>
                  <Link href={`/review#p-${u.id}`} style={{ color: "inherit" }}>
                    {itemText(u)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href="/review" className="fr-btn fr-ghost" style={{ minHeight: 40, marginTop: 8 }}>
            Open photo review
          </Link>
        </div>
      )}
    </div>
  );
}

// Count and link shown at the top of the Records panel.
export function RecordsBadge() {
  const items = useUnread();
  if (items.length === 0) return null;
  return (
    <Link href="/review" className="fr-btn fr-sec" style={{ minHeight: 40, marginTop: 8 }}>
      {items.length} new photo{items.length === 1 ? "" : "s"} to review
    </Link>
  );
}
