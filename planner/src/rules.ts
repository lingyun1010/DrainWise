import type { Asset } from "./planRun";

// Approved preference rules applied as soft weights (boost) or exclusions. Rules come from the
// scheduler's edits (ticket 32) and only count when status is "approved" AND enabled.
export type Rule = {
  id: string;
  kind: "creek_first" | "drop_far_after_rain";
  text: string;
  status: "proposed" | "approved" | "rejected";
  enabled: boolean;
  boost?: number; // creek_first: added to risk for the choice only
  maxDist?: number; // drop_far_after_rain: map units from the depot
};

// Parameters are fixed defaults (assumptions), not learned: reflection only proposes the KIND of rule.
export const RULE_DEFAULTS = { boost: 0.3, maxDist: 350 };

export type RuleContext = { heavyRain?: boolean };

export type RuleResult = {
  assets: Asset[]; // risk is the adjusted value, used to choose stops only
  notes: Map<string, string[]>; // asset id -> rule texts that changed its treatment
  dropped: Map<string, string[]>; // asset id -> rule texts that removed it
};

export function applyRules(
  assets: Asset[],
  rules: Rule[],
  ctx: RuleContext,
  depot: { x: number; y: number },
): RuleResult {
  const live = rules.filter((r) => r.status === "approved" && r.enabled);
  const notes = new Map<string, string[]>();
  const dropped = new Map<string, string[]>();
  if (live.length === 0) return { assets, notes, dropped };

  const add = (m: Map<string, string[]>, id: string, text: string) => m.set(id, [...(m.get(id) ?? []), text]);
  const out: Asset[] = [];
  for (const a of assets) {
    let risk = a.risk;
    let removed = false;
    for (const r of live) {
      if (r.kind === "creek_first" && a.nearCreek) {
        risk = Math.min(1, risk + (r.boost ?? RULE_DEFAULTS.boost));
        add(notes, a.id, r.text);
      } else if (
        r.kind === "drop_far_after_rain" &&
        ctx.heavyRain &&
        Math.hypot(a.x - depot.x, a.y - depot.y) > (r.maxDist ?? RULE_DEFAULTS.maxDist)
      ) {
        add(dropped, a.id, r.text);
        removed = true;
      }
    }
    if (!removed) out.push(risk === a.risk ? a : { ...a, risk });
  }
  return { assets: out, notes, dropped };
}
