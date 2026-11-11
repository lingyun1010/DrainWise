// Scores the GPTs for a report horizon and writes the email. Pure: same inputs, same text.
// Everything here is SAMPLE DATA (simulated model, invented GPTs). The planner part is a suggestion for the contractor.
import { DAYS, horizonInputs } from "./horizon";
import { HIGH_AT, predict, type AssetInput, type ModelJson } from "./riskModel";
import { STORM_MIN_CHANCE_PCT, STORM_MIN_MM, type ReportKind } from "./reportRule";

export type ReportAsset = {
  id: string;
  type: "inlet" | "gpt";
  canopyPct: number;
  daysSinceClean: number;
  hasCamera: boolean;
};
export type ReportRow = { id: string; p: number; day: number; reasons: string[]; hasCamera: boolean };
export type Report = {
  kind: ReportKind;
  subject: string;
  body: string;
  rows: ReportRow[];
  dateLabel: string;
  why: string;
  empty: boolean;
  send: boolean;
};

// Highest-risk day per asset over days 0..lastDay; only assets at or over HIGH_AT. Sorted by risk, highest first.
export function scoreHorizon(
  assets: readonly ReportAsset[],
  model: ModelJson,
  dayRain: readonly number[],
  leaf: number,
  firstDay: number,
  lastDay: number,
): ReportRow[] {
  const best = new Map<string, ReportRow>();
  for (let d = firstDay; d <= lastDay; d++) {
    const hz = horizonInputs(d, 0, dayRain);
    const inputs: AssetInput[] = assets.map((a) => ({
      asset_id: a.id,
      type: a.type,
      canopy_pct: a.canopyPct,
      leaf_index: leaf,
      rain_mm_7d: hz.rain_mm_7d,
      rain_forecast_mm: hz.rain_forecast_mm,
      days_since_clean: a.daysSinceClean + hz.days_added,
      has_camera: a.hasCamera,
    }));
    predict(model, inputs).forEach((s, i) => {
      if (s.p_block < HIGH_AT) return;
      const prev = best.get(s.asset_id);
      if (!prev || s.p_block > prev.p) {
        best.set(s.asset_id, {
          id: s.asset_id,
          p: s.p_block,
          day: d,
          reasons: s.reasons,
          hasCamera: assets[i].hasCamera,
        });
      }
    });
  }
  return [...best.values()].sort((a, b) => b.p - a.p || a.id.localeCompare(b.id));
}

const pct = (p: number) => `${Math.round(p * 100)}%`;
const HEAD =
  "Demo with sample data. DrainWise is a hackathon prototype: the GPTs and the model below are simulated, not council records.";

export function buildReport(kind: ReportKind, rows: readonly ReportRow[], dateLabel: string, whyLine: string): Report {
  const storm = kind === "storm_alert";
  const horizon = "the next 7 days (Today to In 6 days)";
  const listed = `predicted chance of blocking is High (${Math.round(HIGH_AT * 100)}%+)`;
  const subject = storm
    ? `[Sample data] Storm in the 7-day forecast: ${rows.length} GPT${rows.length === 1 ? "" : "s"} to check`
    : `[Sample data] Weekly GPT report: ${rows.length} to check in the next 7 days`;
  const lines: string[] = [
    HEAD,
    "",
    `Report date: ${dateLabel}`,
    `Why this report: ${whyLine}`,
    `Horizon: ${horizon}`,
    `Listed when: ${listed}`,
    "",
  ];
  if (rows.length === 0) {
    lines.push(`No GPT is predicted to be High (${Math.round(HIGH_AT * 100)}%+) in this period.`);
  } else {
    lines.push("GPTs listed, highest predicted risk first:", "");
    rows.forEach((r, i) => {
      const when = ` - first at risk: ${DAYS[r.day]}`;
      lines.push(`${i + 1}. ${r.id}  ${pct(r.p)}${when}${r.hasCamera ? "  (camera site)" : ""}`);
      for (const why of r.reasons) lines.push(`     - ${why}`);
    });
    lines.push(
      "",
      "Suggestion for the contractor (not an instruction): clean the GPTs at the top of this list first, and group nearby ones into one truck run.",
    );
  }
  lines.push(
    "",
    `Storm assumption: a day counts as a storm at ${STORM_MIN_CHANCE_PCT}%+ chance of rain and ${STORM_MIN_MM} mm or more (BoM range). This is an assumption, not a council level.`,
    "Predictions are estimates from a model trained on simulated data. They are not observed blockages.",
  );
  // A storm report with nothing to list sends nothing; an empty weekly report still goes out as a short note.
  return {
    kind,
    subject,
    body: lines.join("\n"),
    rows: [...rows],
    dateLabel,
    why: whyLine,
    empty: rows.length === 0,
    send: !(storm && rows.length === 0),
  };
}
