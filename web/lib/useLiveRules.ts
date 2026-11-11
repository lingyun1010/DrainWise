"use client";
import { useEffect, useState } from "react";
import type { Rule } from "../../planner/src/rules";

type Lesson = { id: string; status: string };
type Pref = { id: string; lesson_id: string; kind: Rule["kind"]; text: string; enabled: boolean };

// Approved AND switched-on rules from the learning tables. Fails quietly to "no rules" (the old plan) when storage is off.
export function useLiveRules(): Rule[] {
  const [rules, setRules] = useState<Rule[]>([]);
  useEffect(() => {
    let alive = true;
    fetch("/api/learning")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { lessons: Lesson[]; prefs: Pref[] } | null) => {
        if (!alive || !d) return;
        const approved = new Set(d.lessons.filter((l) => l.status === "approved").map((l) => l.id));
        setRules(
          d.prefs
            .filter((p) => approved.has(p.lesson_id))
            .map((p) => ({ id: p.id, kind: p.kind, text: p.text, status: "approved", enabled: p.enabled })),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return rules;
}
