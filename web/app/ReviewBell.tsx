"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

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

// Which notifications this admin has marked read. Kept in this browser only (demo, no sign-in); it does not mean the
// photo was reviewed. Records and the photo review page still show every photo that has not been reviewed.
const READ_KEY = "drainwise.readPhotoIds";
const READ_EVT = "drainwise-read";
const readSnapshot = () => {
  try {
    return localStorage.getItem(READ_KEY) ?? "[]";
  } catch {
    return "[]";
  }
};
const readSubscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(READ_EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(READ_EVT, cb);
  };
};
function writeRead(ids: string[]) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(ids.slice(-200)));
  } catch {
    /* storage blocked: the badge just will not remember */
  }
  window.dispatchEvent(new Event(READ_EVT));
}

export default function ReviewBell() {
  const items = useUnread();
  const readRaw = useSyncExternalStore(readSubscribe, readSnapshot, () => "[]");
  const read = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(readRaw) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [readRaw]);
  const unread = items.filter((u) => !read.has(u.id));
  const markRead = (ids: string[]) => writeRead([...read, ...ids.filter((id) => !read.has(id))]);
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
        style={{ minHeight: 40, minWidth: 44, padding: "6px 12px", position: "relative" }}
        aria-expanded={open}
        aria-label={`Notifications: ${unread.length} unread`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path
            d="M12 3a6 6 0 0 0-6 6v3.5L4.5 16h15L18 12.5V9a6 6 0 0 0-6-6Zm-2.2 15a2.2 2.2 0 0 0 4.4 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {unread.length > 0 && (
          <span className="fr-badge" aria-hidden="true">
            {unread.length > 99 ? "99+" : unread.length}
          </span>
        )}
      </button>
      {open && (
        <div
          role="region"
          aria-label="Notifications"
          className="fr-tip"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            width: 300,
            maxWidth: "calc(100vw - 32px)",
            zIndex: 50,
            opacity: 1,
            pointerEvents: "auto", // .fr-tip is a hover card (not clickable); this one holds links
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <strong>Notifications{unread.length > 0 ? ` (${unread.length} unread)` : ""}</strong>
            <button
              type="button"
              className="fr-btn fr-ghost"
              style={{ minHeight: 40 }}
              disabled={unread.length === 0}
              onClick={() => markRead(unread.map((u) => u.id))}
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <div style={{ color: "var(--fr-mute)", marginTop: 6 }}>Nothing waiting.</div>
          ) : (
            <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
              {items.slice(0, 8).map((u) => {
                const isRead = read.has(u.id);
                return (
                  <li
                    key={u.id}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}
                  >
                    <Link
                      href={`/review#p-${u.id}`}
                      onClick={() => markRead([u.id])}
                      style={{ color: "inherit", opacity: isRead ? 0.6 : 1, fontWeight: isRead ? 400 : 700 }}
                    >
                      {itemText(u)}
                      {isRead ? " (read)" : ""}
                    </Link>
                    {!isRead && (
                      <button
                        type="button"
                        className="fr-btn fr-ghost"
                        style={{ minHeight: 40, whiteSpace: "nowrap" }}
                        aria-label={`Mark ${u.assetId} read`}
                        onClick={() => markRead([u.id])}
                      >
                        Mark read
                      </button>
                    )}
                  </li>
                );
              })}
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
