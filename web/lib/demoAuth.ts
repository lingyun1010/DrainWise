// SIMULATED sign-in for the demo. Not security: the names and passwords are in this file, in the browser bundle.
// It only shows the idea that a crew sees its own run and the admin sees everything. Real deployment would use council
// single sign-on. The session lives in sessionStorage, so closing the tab signs out.
export type Session = { role: "admin" } | { role: "crew"; crewId: string };

const norm = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");

// Manager: name admin, password admin. A crew signs in with its own name; the password starts out the same as the name
// ("Crew A" / "Crew A", case does not matter). The accounts are read from the crew list, so adding a crew or renaming
// one changes the sign-in with it. Real deployment: council single sign-on.
export function checkLogin(
  kind: "admin" | "crew",
  name: string,
  password: string,
  crews: readonly { id: string; name: string }[] = [],
): Session | null {
  const n = norm(name);
  if (kind === "admin") return n === "admin" && password === "admin" ? { role: "admin" } : null;
  const hit = n ? crews.find((c) => norm(c.name) === n) : undefined;
  return hit && norm(password) === norm(hit.name) ? { role: "crew", crewId: hit.id } : null;
}

const KEY = "drainwise.session";
const EVT = "drainwise-session";

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (s.role === "admin") return s;
    if (s.role === "crew" && typeof s.crewId === "string") return s;
  } catch {
    /* storage blocked or bad value: signed out */
  }
  return null;
}

export function setSession(s: Session | null): void {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the page still works for this visit */
  }
  window.dispatchEvent(new Event(EVT));
}

export function subscribeSession(fn: () => void): () => void {
  window.addEventListener(EVT, fn);
  return () => window.removeEventListener(EVT, fn);
}
