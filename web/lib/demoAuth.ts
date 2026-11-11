// SIMULATED sign-in for the demo. Not security: the names and passwords are in this file, in the browser bundle.
// It only shows the idea that a crew sees its own run and the admin sees everything. Real deployment would use council
// single sign-on. The session lives in sessionStorage, so closing the tab signs out.
export type Session = { role: "admin" } | { role: "crew"; crewId: string };

type Account = { role: "admin" } | { role: "crew"; crewId: string };
const ACCOUNTS: { names: string[]; password: string; account: Account }[] = [
  { names: ["admin"], password: "admin", account: { role: "admin" } },
  { names: ["a", "crew a", "crewa"], password: "ibis", account: { role: "crew", crewId: "c1" } },
  { names: ["b", "crew b", "crewb"], password: "magpie", account: { role: "crew", crewId: "c2" } },
  { names: ["c", "crew c", "crewc"], password: "lorikeet", account: { role: "crew", crewId: "c3" } },
];

export function checkLogin(kind: "admin" | "crew", name: string, password: string): Session | null {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  const hit = ACCOUNTS.find((a) => a.account.role === kind && a.names.includes(n) && a.password === password);
  return hit ? hit.account : null;
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
