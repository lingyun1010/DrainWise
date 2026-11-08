"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cleanRoomCode } from "../../planner/src/roomCode";
import { createRoom, getRoomCode, joinRoom, leaveRoom, subscribeRoom } from "@/lib/runStore";
import Dialog from "./Dialog";

// Shared room control: lets a laptop (Manager) and a phone (Crew) work on the same sample session.
// Used on the role screen, the manager header and the crew phone. Sample data only, no sign-in.
export default function RoomChip({ compact = false }: { compact?: boolean }) {
  const code = useSyncExternalStore(subscribeRoom, getRoomCode, () => null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // A phone opens /crew?room=ABCD from the manager's link: join, then tidy the address bar.
  useEffect(() => {
    const raw =
      new URLSearchParams(window.location.search).get("team") ??
      new URLSearchParams(window.location.search).get("room");
    const fromUrl = cleanRoomCode(raw);
    if (!fromUrl) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("team");
    url.searchParams.delete("room");
    window.history.replaceState(null, "", url.pathname + url.search);
    if (fromUrl !== getRoomCode()) {
      void joinRoom(fromUrl).then((r) => {
        if (!r.ok) {
          setError(r.error);
          setOpen(true);
        }
      });
    }
  }, []);

  const typedCode = cleanRoomCode(typed);

  // After creating, the dialog stays open and shows the new code; after joining it closes.
  async function run(action: () => ReturnType<typeof createRoom>, closeAfter: boolean) {
    setBusy(true);
    setError(null);
    const r = await action();
    setBusy(false);
    if (r.ok) {
      if (closeAfter) setOpen(false);
      setTyped("");
    } else setError(r.error);
  }

  // A phone cannot open "localhost", and the browser cannot see the laptop's Wi-Fi address.
  const onLocalhost = typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const link = code && typeof window !== "undefined" ? `${window.location.origin}/crew?team=${code}` : "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(onLocalhost ? (code ?? "") : link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the link is shown on screen to copy by hand */
    }
  }

  return (
    <>
      <button
        type="button"
        className={`fr-btn ${code ? "fr-sec" : "fr-ghost"}`}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        style={{ padding: "6px 12px", minHeight: 40, fontSize: compact ? 14 : 15 }}
      >
        {code ? `Team ${code}` : "Shared team"}
      </button>
      {open && (
        <Dialog
          label="Shared team"
          eyebrow="TWO DEVICES"
          title={code ? `Team ${code}` : "Use two devices"}
          onClose={() => setOpen(false)}
          actions={
            code ? (
              <>
                <button type="button" className="fr-btn fr-pri" onClick={copy}>
                  {copied ? "Copied" : onLocalhost ? "Copy team code" : "Copy phone link"}
                </button>
                <button
                  type="button"
                  className="fr-btn fr-sec"
                  onClick={() => {
                    leaveRoom();
                    setOpen(false);
                  }}
                >
                  Leave team
                </button>
                <button type="button" className="fr-btn fr-ghost" onClick={() => setOpen(false)}>
                  Close
                </button>
              </>
            ) : (
              <>
                <button type="button" className="fr-btn fr-pri" disabled={busy} onClick={() => run(createRoom, false)}>
                  Start a new team (code is made for you)
                </button>
                <button
                  type="button"
                  className="fr-btn fr-sec"
                  disabled={busy || !typedCode}
                  onClick={() => typedCode && run(() => joinRoom(typedCode), true)}
                >
                  Join with this code
                </button>
                <button type="button" className="fr-btn fr-ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </>
            )
          }
        >
          {code ? (
            <>
              <p
                aria-label={`Team code ${code}`}
                style={{ margin: "0 0 12px", fontSize: 44, fontWeight: 700, letterSpacing: 8, textAlign: "center" }}
              >
                {code}
              </p>
              <p style={{ margin: "0 0 10px", lineHeight: 1.5 }}>
                This device shares its sample session with every device in team {code}. Runs, records and the log sync
                about every 2 seconds. Photos already go to the server on their own.
              </p>
              <p style={{ margin: 0, lineHeight: 1.5, color: "#B9D6E3", wordBreak: "break-all" }}>
                {onLocalhost ? (
                  <>On the other device, choose Shared team, then join with {code}.</>
                ) : (
                  <>
                    On the phone, open <strong>{link}</strong> or choose Crew and join team {code}.
                  </>
                )}
              </p>
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 14px", lineHeight: 1.5 }}>
                Two devices (for example a laptop as Manager and a phone as Crew) can share one sample session. Anyone
                with the team code can see and change it. Teams are removed after 24 hours without changes.
              </p>
              <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>1. Start a new team</h3>
              <p style={{ margin: "0 0 14px", lineHeight: 1.5, color: "#B9D6E3" }}>
                Do this on the first device. You do not type anything: the app makes a 4-letter code and shows it here.
              </p>
              <h3 style={{ margin: "0 0 4px", fontSize: 16 }}>2. Join a team</h3>
              <label style={{ display: "block", fontSize: 14, color: "#B9D6E3", marginBottom: 6 }}>
                On the second device, type the code the first device shows
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value.slice(0, 5))}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="ABCD"
                  style={{
                    display: "block",
                    width: "100%",
                    boxSizing: "border-box",
                    marginTop: 6,
                    minHeight: 44,
                    padding: "6px 12px",
                    borderRadius: 12,
                    border: "2px solid #1E4A63",
                    background: "#0B2233",
                    color: "#EAF6FB",
                    fontSize: 22,
                    letterSpacing: 4,
                    textTransform: "uppercase",
                  }}
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" style={{ margin: "12px 0 0", color: "#FFB38A" }}>
              {error}
            </p>
          )}
        </Dialog>
      )}
    </>
  );
}
