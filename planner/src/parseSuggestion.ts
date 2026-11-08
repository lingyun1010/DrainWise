// Turns the vision model's raw JSON text into a safe suggestion. Pure, so it is easy to test.
// The model can return anything; only a level 0-3 is accepted, confidence is clamped to 0-1,
// and the rationale is trimmed. A suggestion is never a label: a human has to confirm it.

export type BlockLevel = 0 | 1 | 2 | 3;
export type Suggestion = { level: BlockLevel; confidence: number; rationale: string };
export type ParsedSuggestion = { ok: true; suggestion: Suggestion } | { ok: false; error: string };

const MAX_RATIONALE = 280;

export function parseSuggestion(raw: string): ParsedSuggestion {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, error: "model reply was not JSON" };
  }
  if (typeof data !== "object" || data === null) return { ok: false, error: "model reply was not an object" };
  const { level, confidence, rationale } = data as Record<string, unknown>;
  if (level !== 0 && level !== 1 && level !== 2 && level !== 3) {
    return { ok: false, error: "model level was not 0, 1, 2 or 3" };
  }
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return { ok: false, error: "model confidence was not a number" };
  }
  const text = typeof rationale === "string" ? rationale.trim().slice(0, MAX_RATIONALE) : "";
  return {
    ok: true,
    suggestion: { level, confidence: Math.min(1, Math.max(0, confidence)), rationale: text },
  };
}
