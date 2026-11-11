// The truck run the Manager page is showing right now, shared with the chat so "email the plan" sends the same stops.
// Plain module state: both live in the same browser page. Null when no plan is on screen (for example on another page).
import type { PlanEmailStop } from "../../planner/src/planEmail";

export type CurrentPlan = { stops: PlanEmailStop[]; capacity: number };
let current: CurrentPlan | null = null;

export function publishPlan(p: CurrentPlan | null): void {
  current = p;
}
export function getCurrentPlan(): CurrentPlan | null {
  return current;
}
