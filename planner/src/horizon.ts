// Which day are we scoring? Crews are planned a day ahead, so the manager can look at Today, Tomorrow, and so on.
// The day moves three model inputs: days since clean (+1 per day), rain in the last 7 days (rain from before today
// drops out of the 7-day window a seventh per day, the sample rain of the days in between lands) and forecast rain
// (the sample rain for that day).
// DAY_RAIN_MM is SAMPLE data, used only when the BoM feed (/api/bom) cannot be reached. With the feed, the page passes
// the middle of BoM's daily rain range instead.

export const DAYS = ["Today", "Tomorrow", "In 2 days", "In 3 days", "In 4 days", "In 5 days", "In 6 days"] as const; // BoM forecasts run 7 days
export const DAY_RAIN_MM = [10, 28, 6, 2, 0, 14, 35]; // sample mm per day, the model's forecast-rain input is capped at 80
export const BASE_RAIN_7D = 20; // sample rain already on the ground today
export const MAX_RAIN_MM = 80; // upper end of the simulated training range

export type HorizonInputs = { days_added: number; rain_mm_7d: number; rain_forecast_mm: number };

// Extra rain is extra millimetres over the whole period (today to the chosen day), shared evenly between those days.
// So "+30 mm over 3 days" adds 10 mm to each of the three days, and it shows in the chart and its accumulate line.
export function horizonInputs(day: number, extraMm: number, dayRain: readonly number[] = DAY_RAIN_MM): HorizonInputs {
  const d = Math.max(0, Math.min(DAYS.length - 1, Math.round(day)));
  const share = Math.max(0, extraMm) / (d + 1);
  const fallen = dayRain.slice(0, d).reduce((a, b) => a + b + share, 0);
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    days_added: d,
    rain_mm_7d: Math.min(MAX_RAIN_MM, round1((BASE_RAIN_7D * (7 - d)) / 7 + fallen)),
    rain_forecast_mm: Math.min(MAX_RAIN_MM, round1((dayRain[d] ?? 0) + share)),
  };
}
