// A MOCK "AI check" for the public demo (ticket 16). It does not look at the photo and is not a model.
// It turns the stop's sample risk into a plausible blockage level so the demo has something to show.
// The UI must say "mock" next to every result. The real vision call stays local (see web/lib/review.ts).
import type { BlockLevel, Suggestion } from "./parseSuggestion";

const TEXT: Record<BlockLevel, string> = {
  0: "Mock: the net looks open.",
  1: "Mock: a few leaves on the net, water can still pass.",
  2: "Mock: about half of the net is covered with leaves.",
  3: "Mock: the net looks covered with leaves and debris.",
};

// pct = the stop's estimated risk in percent (sample data); seed = any number that varies per photo.
export function mockSuggestion(pct: number | undefined, seed: number): Suggestion {
  const base: BlockLevel = pct === undefined ? 1 : pct >= 60 ? 3 : pct >= 30 ? 2 : 1;
  const s = Math.abs(Math.trunc(seed));
  const level = (s % 4 === 0 && base > 0 ? base - 1 : base) as BlockLevel;
  return { level, confidence: 0.55 + (s % 35) / 100, rationale: TEXT[level] };
}
