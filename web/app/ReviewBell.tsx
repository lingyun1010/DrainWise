"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import cameraReadings from "@/lib/cameraReadings.json";
import imageReadings from "@/lib/imageReadings.json";
import { loadState, subscribeRun } from "@/lib/runStore";

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

// One notification. Colour AND a text tag show the kind (never colour alone):
// red = urgent (a camera sees a net that is full, broken or fallen), yellow = a report email went out, green = photo received.
type Kind = "urgent" | "email" | "photo";
type Note = { id: string; kind: Kind; text: string; assetId?: string; photoId?: string };
const KIND: Record<Kind, { tag: string; color: string; summary: (n: number) => string }> = {
  urgent: {
    tag: "Urgent",
    color: "#FF8185",
    summary: (n) => `${n} ${n === 1 ? "camera needs" : "cameras need"} a look`,
  },
  email: { tag: "Email sent", color: "#FFD27A", summary: (n) => `${n} report ${n === 1 ? "email" : "emails"} sent` },
  photo: { tag: "Photo", color: "#7ED9A3", summary: (n) => `${n} new before ${n === 1 ? "photo" : "photos"}` },
};
const GROUPS: Kind[] = ["urgent", "email", "photo"];
const RANK: Record<Kind, number> = { urgent: 0, email: 1, photo: 2 };
const DAMAGE_WORD: Record<string, string> = {
  net_full: "net is full (70%+)",
  net_broken: "net may be broken",
  net_fallen: "net may have fallen off",
};

// SAMPLE DATA: stored camera readings, not live. A real build would read the latest frame result.
const CAMERA_ALERTS: Note[] = cameraReadings.readings.flatMap((r) => {
  const cam = (imageReadings.cameras as Record<string, { reading: { damage: string } }>)[`cam-0${r.photo}`];
  const word = cam ? DAMAGE_WORD[cam.reading.damage] : undefined;
  return word
    ? [
        {
          id: `cam:${r.asset_id}`,
          kind: "urgent" as const,
          assetId: r.asset_id,
          text: `${r.asset_id}: ${word} (camera, sample data)`,
        },
      ]
    : [];
});

function useMailNotes(): Note[] {
  const [notes, setNotes] = useState<Note[]>([]);
  useEffect(() => {
    const refresh = () => {
      const log = loadState().log;
      setNotes(
        log
          .filter((l) => l.x.startsWith("Email report sent"))
          .slice(0, 5)
          .map((l) => ({ id: `mail:${l.t}:${l.x}`, kind: "email" as const, text: `${l.x} at ${l.t}` })),
      );
    };
    refresh();
    return subscribeRun(refresh);
  }, []);
  return notes;
}

export default function ReviewBell({ onOpenAsset }: { onOpenAsset?: (id: string) => void }) {
  const photos = useUnread();
  const mail = useMailNotes();
  const readRaw = useSyncExternalStore(readSubscribe, readSnapshot, () => "[]");
  const read = useMemo(() => {
    try {
      return new Set<string>(JSON.parse(readRaw) as string[]);
    } catch {
      return new Set<string>();
    }
  }, [readRaw]);
  const items: Note[] = useMemo(
    () =>
      [
        ...CAMERA_ALERTS,
        ...mail,
        ...photos.map((u) => ({ id: u.id, kind: "photo" as const, text: itemText(u), photoId: u.id })),
      ].sort((a, b) => RANK[a.kind] - RANK[b.kind]),
    [mail, photos],
  );
  const unread = items.filter((n) => !read.has(n.id));
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

  const row = (n: Note, grouped = false) => {
    const isRead = read.has(n.id);
    const k = KIND[n.kind];
    const body = (
      <>
        {!grouped && (
          <>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: k.color }}>
              {k.tag.toUpperCase()}
            </span>
            <br />
          </>
        )}
        {n.text}
        {isRead ? " (read)" : ""}
      </>
    );
    const style = {
      color: "inherit",
      textAlign: "left" as const,
      background: "none",
      border: 0,
      padding: 0,
      font: "inherit",
      cursor: "pointer",
      opacity: isRead ? 0.6 : 1,
      fontWeight: isRead ? 400 : 700,
    };
    return (
      <li
        key={n.id}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          ...(grouped ? {} : { borderLeft: `4px solid ${k.color}`, paddingLeft: 8 }),
        }}
      >
        {n.photoId ? (
          <Link href={`/review#p-${n.photoId}`} onClick={() => markRead([n.id])} style={style}>
            {body}
          </Link>
        ) : n.assetId && onOpenAsset ? (
          <button
            type="button"
            style={style}
            onClick={() => {
              markRead([n.id]);
              setOpen(false);
              onOpenAsset(n.assetId!);
            }}
          >
            {body}
          </button>
        ) : (
          <span style={style}>{body}</span>
        )}
        {!isRead && (
          <button
            type="button"
            className="fr-btn fr-ghost"
            style={{ minHeight: 40, whiteSpace: "nowrap" }}
            aria-label={`Mark ${n.text} read`}
            onClick={() => markRead([n.id])}
          >
            Mark read
          </button>
        )}
      </li>
    );
  };

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
            width: 360,
            maxWidth: "calc(100vw - 32px)",
            zIndex: 50,
            opacity: 1,
            pointerEvents: "auto", // .fr-tip is a hover card (not clickable); this one holds links
          }}
        >
          {items.length === 0 ? (
            <div style={{ color: "var(--fr-mute)" }}>Nothing waiting.</div>
          ) : (
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "grid",
                gap: 6,
                maxHeight: 300,
                overflowY: "auto",
              }}
            >
              {GROUPS.map((kind) => {
                const list = items.filter((n) => n.kind === kind);
                if (list.length === 0) return null;
                const k = KIND[kind];
                const unreadN = list.filter((n) => !read.has(n.id)).length;
                return (
                  <li key={kind} style={{ borderLeft: `4px solid ${k.color}`, paddingLeft: 8 }}>
                    <details open={list.length === 1}>
                      <summary style={{ cursor: "pointer", minHeight: 24, fontWeight: unreadN ? 700 : 400 }}>
                        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".06em", color: k.color }}>
                          {k.tag.toUpperCase()}
                        </span>
                        <br />
                        {k.summary(list.length)}
                        {unreadN ? ` (${unreadN} unread)` : " (all read)"}
                      </summary>
                      <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                        {list.map((n) => row(n, true))}
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
            <Link href="/review" className="fr-btn fr-ghost" style={{ minHeight: 40, whiteSpace: "nowrap" }}>
              Open photo review
            </Link>
            <button
              type="button"
              className="fr-btn fr-sec"
              style={{ minHeight: 40, whiteSpace: "nowrap" }}
              disabled={unread.length === 0}
              onClick={() => markRead(unread.map((n) => n.id))}
            >
              Mark all read
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
