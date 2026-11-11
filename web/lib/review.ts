// Server-only helpers for the local photo review page (ticket 13).
// The review page and its routes exist in every build (owner decision 2026-11-08: public too).
// Suggestions come from a built-in MOCK (no AI, no network). The real vision call was removed on 2026-11-11.
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ParsedSuggestion } from "../../planner/src/parseSuggestion";

export const SAMPLE_COUNT = 7;

export function reviewEnabled(): boolean {
  return true;
}

// Suggestions are always fake and must be labelled as such.
export function mockMode(): boolean {
  return true;
}

// Deterministic fake suggestion from the image bytes. Not a model: it only lets the review flow be
// tried without a key. Same image, same answer.
export function mockSuggestion(image: Buffer): ParsedSuggestion {
  let h = 0;
  for (let i = 0; i < image.length; i += 97) h = (h * 31 + image[i]) >>> 0;
  const level = (h % 4) as 0 | 1 | 2 | 3;
  const names = ["clear", "light debris", "about half blocked", "blocked"];
  return {
    ok: true,
    suggestion: {
      level,
      confidence: 0.5,
      rationale: `MOCK, not an AI: picked "${names[level]}" from the file bytes so you can try the review flow.`,
    },
  };
}

// n is checked as an integer 1..7, so it can never build a path outside the sample folder.
export function parseSampleNumber(raw: unknown): number | null {
  const n = typeof raw === "string" ? Number(raw) : raw;
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= SAMPLE_COUNT ? n : null;
}

// Local copies of the 7 sample images live in the repo's gitignored .local/sample-photos/.
export async function readSample(n: number): Promise<Buffer | null> {
  const file = path.join(process.cwd(), "..", ".local", "sample-photos", `sample-${n}.jpg`);
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}

// The real vision call was removed (owner decision 2026-11-11): photo suggestions stay a labelled mock.
export async function suggestLevel(image: Buffer): Promise<ParsedSuggestion> {
  return mockSuggestion(image);
}
