"use client";

import { useEffect, useRef } from "react";

// The ONE modal for the whole app. Every popup (details, choose a crew, confirm) must use Dialog or ConfirmDialog
// so size, colours, spacing, buttons and keyboard behaviour stay the same. See "UI consistency" in CLAUDE.md.
//
// Layout: small caps eyebrow, h2 title, body, then an actions row (primary button first, quiet Cancel last).
// Fixed to the viewport and centred; the card uses margin:auto so a tall card scrolls instead of being clipped.
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
const TONE = { info: { border: "#4FC3E8", eyebrow: "#8FD8F0" }, danger: { border: "#FF8A4C", eyebrow: "#FFB38A" } };

export default function Dialog({
  label,
  eyebrow,
  title,
  tone = "info",
  maxWidth = 460,
  onClose,
  children,
  actions,
}: {
  label: string; // accessible name
  eyebrow?: string;
  title: string;
  tone?: keyof typeof TONE; // danger = Remove or Withdraw style confirmations
  maxWidth?: number;
  onClose: () => void;
  children: React.ReactNode;
  actions: React.ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); // the listener below is added once, not on every parent render
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Keyboard: Esc closes, Tab stays inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return closeRef.current();
      if (e.key !== "Tab" || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !box.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !box.current.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Focus moves in when the dialog opens (unless a control inside already asked for it with autoFocus) and goes
  // back to the button that opened it when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    if (box.current && !box.current.contains(document.activeElement)) {
      (box.current.querySelector<HTMLElement>(FOCUSABLE) ?? box.current).focus();
    }
    return () => {
      if (opener && opener.isConnected) opener.focus();
    };
  }, []);

  const c = TONE[tone];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={{
        position: "fixed",
        inset: 0,
        overflowY: "auto",
        background: "rgba(5,15,25,.7)",
        display: "flex",
        padding: 20,
        zIndex: 20,
      }}
    >
      <div
        ref={box}
        tabIndex={-1}
        className="fr-pop"
        style={{
          background: "#102F45",
          border: `3px solid ${c.border}`,
          borderRadius: 24,
          padding: 24,
          maxWidth,
          width: "100%",
          margin: "auto",
        }}
      >
        {eyebrow && (
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".06em", color: c.eyebrow }}>
            {eyebrow.toUpperCase()}
          </div>
        )}
        <h2 style={{ margin: "6px 0 10px", fontSize: 24, fontWeight: 700 }}>{title}</h2>
        <div style={{ fontSize: 15, lineHeight: 1.5, color: "#CFE6F0" }}>{children}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 18 }}>{actions}</div>
      </div>
    </div>
  );
}

// Yes/no confirmation. Focus starts on Cancel so Enter never confirms a destructive action by accident.
export function ConfirmDialog({
  label,
  eyebrow,
  title,
  tone = "danger",
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: {
  label: string;
  eyebrow?: string;
  title: string;
  tone?: keyof typeof TONE;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog
      label={label}
      eyebrow={eyebrow}
      title={title}
      tone={tone}
      onClose={onCancel}
      actions={
        <>
          <button className="fr-btn fr-pri" type="button" onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button className="fr-btn fr-ghost" type="button" autoFocus onClick={onCancel}>
            Cancel
          </button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
