"use client";

import { useEffect, useId, useRef, useState } from "react";

// Dropdown for "Add a GPT to the run". A native <select> opens the operating system's own list, which never matches the
// app, so this draws the list in the app's style (dark panel, 2px border, radius 16, same rows as the other lists).
// Keyboard: Enter/Space/Arrow opens, Up/Down moves, Enter picks, Esc closes. See "Dropdowns" in CLAUDE.md.
export type PickerOption = { id: string; label: string; detail: string };

export default function GptPicker({
  options,
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [hot, setHot] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const chosen = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[hot]?.scrollIntoView({ block: "nearest" });
  }, [open, hot]);

  function show() {
    setHot(
      Math.max(
        0,
        options.findIndex((o) => o.id === value),
      ),
    );
    setOpen(true);
  }
  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation();
      return setOpen(false);
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return show();
      const d = e.key === "ArrowDown" ? 1 : -1;
      return setHot((h) => (h + d + options.length) % options.length);
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!open) return show();
      const o = options[hot];
      if (o) pick(o.id);
    }
  }

  return (
    <div ref={root} style={{ position: "relative", flex: 1, minWidth: 0, display: "flex" }}>
      <button
        type="button"
        className="fr-select"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
        style={{ textAlign: "left", cursor: "pointer", color: chosen ? undefined : "var(--fr-mute)" }}
      >
        {chosen ? `${chosen.label} · ${chosen.detail}` : placeholder}
      </button>
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "calc(100% + 6px)",
            zIndex: 5,
            margin: 0,
            padding: 6,
            listStyle: "none",
            maxHeight: 240,
            overflowY: "auto",
            background: "var(--fr-panel)",
            border: "2px solid var(--fr-line2)",
            borderRadius: 16,
            boxShadow: "0 12px 30px rgba(0,0,0,.45)",
          }}
        >
          {options.map((o, i) => {
            const on = o.id === value;
            return (
              <li
                key={o.id}
                role="option"
                aria-selected={on}
                onMouseEnter={() => setHot(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "center",
                  minHeight: 40,
                  padding: "6px 12px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: on ? 700 : 600,
                  color: "var(--fr-text)",
                  background: i === hot ? "var(--fr-line)" : "transparent",
                  border: `2px solid ${on ? "var(--fr-blue)" : "transparent"}`,
                }}
              >
                <span>{o.label}</span>
                <span style={{ color: "var(--fr-soft)", fontWeight: 600 }}>{o.detail}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
