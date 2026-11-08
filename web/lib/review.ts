// Server-only helpers for the local photo review page (ticket 13).
// The review page and its routes exist only when OPENAI_API_KEY is set in the local, gitignored
// web/.env.local and this is not the public build. The key is read here and never sent to the browser.
import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseSuggestion, type ParsedSuggestion } from "../../planner/src/parseSuggestion";

export const SAMPLE_COUNT = 7;
const MODEL = process.env.OPENAI_VISION_MODEL ?? "gpt-4o-mini";
// Server-side only. Lets a local mock stand in for the service when testing without a real key.
const BASE_URL = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

export function reviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PUBLIC_BUILD !== "1" && !!process.env.OPENAI_API_KEY;
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

const PROMPT = [
  "You look at one photo of a stormwater drain inlet or gross pollutant trap (GPT) taken by a fixed camera.",
  "Rate how blocked it is with leaves, litter or debris:",
  "0 = clear, 1 = light debris, 2 = about half blocked, 3 = blocked or overflowing.",
  "If you cannot see the drain, say so in the rationale and lower the confidence.",
  "Give a confidence from 0 to 1 and a rationale of at most 25 words.",
  "Describe only the drain and debris. Do not describe or identify people or number plates.",
].join(" ");

export async function suggestLevel(image: Buffer): Promise<ParsedSuggestion> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, error: "no vision key configured" };
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: MODEL,
        max_completion_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image.toString("base64")}` } },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "blockage",
            strict: true,
            schema: {
              type: "object",
              properties: {
                level: { type: "integer", enum: [0, 1, 2, 3] },
                confidence: { type: "number" },
                rationale: { type: "string" },
              },
              required: ["level", "confidence", "rationale"],
              additionalProperties: false,
            },
          },
        },
      }),
    });
  } catch {
    return { ok: false, error: "vision service is not reachable" };
  }
  // Never echo the response body: it can contain request details. Status code only.
  if (!res.ok) return { ok: false, error: `vision service returned ${res.status}` };
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  return typeof text === "string" ? parseSuggestion(text) : { ok: false, error: "vision reply was empty" };
}
