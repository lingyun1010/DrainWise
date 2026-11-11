"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Dialog from "./Dialog";
import { getRoomCode } from "@/lib/runStore";

// The floating chatbot (ticket 31): a small cloud button that opens the assistant in the shared Dialog card.
// Answers come from /api/chat (Claude, with read-only tools). The key never reaches the browser.
type Msg = { role: "user" | "assistant"; content: string; tools?: string[]; failed?: boolean };

const TOOL_LABEL: Record<string, string> = {
  get_rain_outlook: "BoM rain forecast",
  get_risk_ranking: "risk model (sample data)",
  get_crew_progress: "crew progress (sample session)",
};
// Questions the panel always offers, and the short tips the closed button says out loud (bubble text -> question).
const EXAMPLES = ["What is the rain outlook?", "Which GPTs are fullest?", "How far along is each crew?"];
const TIPS = [
  { say: "Will it rain this week? Ask me.", q: "Will it rain this week?" },
  { say: "Ask me about the rain outlook", q: "What is the rain outlook?" },
  { say: "Which GPTs are fullest? Ask me.", q: "Which GPTs are fullest?" },
  { say: "Want to know how far along each crew is?", q: "How far along is each crew?" },
  { say: "Ask me what 40 mm more rain would do", q: "What if there is 40 mm of extra rain? Show the top 3 GPTs." },
  { say: "Which GPTs need cleaning first? Ask me.", q: "Which GPTs should be cleaned first and why?" },
];
const SHOW_MS = 7000; // how long a tip stays
const GAP_MS = 14000; // quiet time between tips

function Cloud() {
  return (
    <svg viewBox="-50 -34 100 62" width="56" height="35" aria-hidden="true" focusable="false">
      <g className="fr-bob">
        <circle cx="-26" cy="4" r="18" fill="#EAF6FB" />
        <circle cx="0" cy="-6" r="24" fill="#EAF6FB" />
        <circle cx="28" cy="4" r="18" fill="#EAF6FB" />
        <rect x="-44" y="4" width="90" height="18" rx="9" fill="#EAF6FB" />
        <g className="fr-blink">
          <circle cx="-8" cy="4" r="3.2" fill="#0B2233" />
          <circle cx="10" cy="4" r="3.2" fill="#0B2233" />
        </g>
        <path d="M-6 12 q5 5 10 0" fill="none" stroke="#0B2233" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="-16" cy="11" r="4" fill="#FFB38A" opacity=".7" />
        <circle cx="18" cy="11" r="4" fill="#FFB38A" opacity=".7" />
      </g>
    </svg>
  );
}

export default function ChatButton() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState<number | null>(null); // index in TIPS while the bubble is showing
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  // While the chat is closed the cloud says a random tip now and then, so people learn what to ask.
  useEffect(() => {
    if (open) return;
    let last = -1;
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      let next = Math.floor(Math.random() * TIPS.length);
      if (next === last) next = (next + 1) % TIPS.length;
      last = next;
      setTip(next);
      timer = setTimeout(hide, SHOW_MS);
    };
    const hide = () => {
      setTip(null);
      timer = setTimeout(show, GAP_MS);
    };
    timer = setTimeout(show, 1500);
    return () => {
      clearTimeout(timer);
      setTip(null);
    };
  }, [open]);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [msgs, busy, open]);

  if (path.startsWith("/crew")) return null; // the crew phone stays small and focused

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setText("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.filter((m) => !m.failed).map(({ role, content }) => ({ role, content })),
          team: getRoomCode(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { reply?: string; tools?: string[]; message?: string };
      if (res.ok && data.reply) setMsgs([...next, { role: "assistant", content: data.reply, tools: data.tools }]);
      else
        setMsgs([
          ...next,
          { role: "assistant", content: data.message ?? "Chat could not answer just now.", failed: true },
        ]);
    } catch {
      setMsgs([
        ...next,
        { role: "assistant", content: "Chat could not answer just now. Please try again.", failed: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const openChat = (question?: string) => {
    setTip(null);
    setOpen(true);
    if (question) void send(question);
  };

  return (
    <>
      <div className="fr-chatfab">
        {tip !== null && !open && (
          <button type="button" className="fr-chathint" onClick={() => openChat(TIPS[tip].q)}>
            {TIPS[tip].say}
          </button>
        )}
        <button type="button" className="fr-chatbtn" aria-label="Ask the assistant" onClick={() => openChat()}>
          <Cloud />
        </button>
      </div>
      {open && (
        <Dialog
          label="Assistant"
          eyebrow="Assistant · sample data"
          title="Ask DrainWise"
          maxWidth={520}
          closeOnOutside
          focusDialog
          onClose={() => setOpen(false)}
          actions={
            <>
              <button className="fr-btn fr-pri" type="submit" form="fr-chatform" disabled={busy || !text.trim()}>
                Send
              </button>
              <button className="fr-btn fr-ghost" type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </>
          }
        >
          <div className="fr-chatlog" role="log" aria-live="polite" aria-label="Conversation">
            {msgs.length === 0 && (
              <p style={{ margin: 0 }}>
                I read the rain forecast, the risk ranking and crew progress. GPT positions, crews and the risk model
                are sample data.
              </p>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "fr-chatme" : "fr-chatbot"}>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                {m.tools && m.tools.length > 0 && (
                  <div className="fr-chatused">Data used: {m.tools.map((t) => TOOL_LABEL[t] ?? t).join(", ")}</div>
                )}
              </div>
            ))}
            {busy && <div className="fr-chatbot">Looking at the data...</div>}
            <div ref={end} />
          </div>
          <div className="fr-chatchips" aria-label="Suggested questions">
            {EXAMPLES.map((e) => (
              <button key={e} type="button" className="fr-chip" disabled={busy} onClick={() => send(e)}>
                {e}
              </button>
            ))}
          </div>
          <form
            id="fr-chatform"
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
            style={{ marginTop: 12 }}
          >
            <label htmlFor="fr-chatinput" className="fr-sr">
              Your question
            </label>
            <input
              id="fr-chatinput"
              className="fr-chatinput"
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask about rain, full GPTs or crews"
              autoComplete="off"
            />
          </form>
        </Dialog>
      )}
    </>
  );
}
