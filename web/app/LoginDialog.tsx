"use client";

import { useState } from "react";
import Dialog from "./Dialog";
import { checkLogin, setSession, type Session } from "../lib/demoAuth";
import { loadState } from "../lib/runStore";

// Simulated sign-in (see lib/demoAuth.ts). Same Dialog as every popup. The names and passwords are not shown here.
export default function LoginDialog({
  kind,
  onSuccess,
  onCancel,
}: {
  kind: "admin" | "crew";
  onSuccess: (s: Session) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const label = kind === "admin" ? "Manager sign-in" : "Crew sign-in";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = checkLogin(kind, name, password, loadState().crews);
    if (!s) return setError("Name or password is wrong.");
    setSession(s);
    onSuccess(s);
  }

  // Skip: the demo needs no typing. Manager skips as admin; Crew skips as the first crew (its own run only).
  function skip() {
    const first = loadState().crews[0];
    const s: Session = kind === "crew" && first ? { role: "crew", crewId: first.id } : { role: "admin" };
    setSession(s);
    onSuccess(s);
  }

  const field: React.CSSProperties = {
    width: "100%",
    minHeight: 44,
    boxSizing: "border-box",
    background: "#0B2233",
    color: "#EAF6FB",
    border: "2px solid #1E4A63",
    borderRadius: 12,
    padding: "6px 12px",
    fontSize: 15,
    fontFamily: "inherit",
  };

  return (
    <Dialog
      label={label}
      eyebrow="Sign in (simulated)"
      title={label}
      onClose={onCancel}
      focusDialog
      actions={
        <>
          <button className="fr-btn fr-pri" type="submit" form="fr-login">
            Sign in
          </button>
          <button className="fr-btn fr-sec" type="button" onClick={skip}>
            Skip sign-in
          </button>
          <button className="fr-btn fr-ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        </>
      }
    >
      <form id="fr-login" onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 4 }}>
          {kind === "admin" ? "Name" : "Crew name (for example Crew A)"}
          <input
            autoComplete="off"
            autoCapitalize="none"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            style={field}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          Password
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            style={field}
          />
        </label>
        {error && (
          <div role="alert" style={{ fontSize: 14, fontWeight: 600, color: "#FFB38A" }}>
            {error}
          </div>
        )}
        <p style={{ margin: 0, fontSize: 14, color: "#CFE6F0", lineHeight: 1.5 }}>
          {kind === "admin" ? (
            <>
              <b>Try it:</b> name <b>admin</b>, password <b>admin</b>, or just press <b>Skip sign-in</b>.
            </>
          ) : (
            <>
              <b>Try it:</b> the name and the password are the same, the crew&apos;s name: <b>Crew A</b> and{" "}
              <b>Crew A</b>. Also Crew B and Crew C. A renamed or new crew signs in with its new name.{" "}
              <b>Skip sign-in</b> opens the first crew.
            </>
          )}
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#8FB8CC" }}>
          {kind === "admin"
            ? "The manager sees every crew and can send runs."
            : "A crew sees only its own run. Other crews stay hidden."}{" "}
          Demo sign-in only, not real security. Real deployment would use council single sign-on.
        </p>
      </form>
    </Dialog>
  );
}
