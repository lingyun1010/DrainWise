import { expect, it } from "vitest";
import { DAYS, horizonInputs } from "./horizon";

it("Today with no extra rain is the default scenario (rain 20 mm, forecast 10 mm)", () => {
  expect(horizonInputs(0, 0)).toEqual({ days_added: 0, rain_mm_7d: 20, rain_forecast_mm: 10 });
});

it("each later day adds a day since clean and the rain that fell in between", () => {
  // 20 mm from before today fades by a seventh per day while the sample rain of the days in between lands.
  expect(horizonInputs(1, 0)).toEqual({ days_added: 1, rain_mm_7d: 27.1, rain_forecast_mm: 28 });
  expect(horizonInputs(2, 0)).toEqual({ days_added: 2, rain_mm_7d: 52.3, rain_forecast_mm: 6 });
});

it("extra rain is millimetres over the whole period, shared evenly between its days", () => {
  expect(horizonInputs(0, 30).rain_forecast_mm).toBe(40); // 10 sample + 30
  // 3 days (today to day 2): +10 mm on each day
  const r = horizonInputs(2, 30);
  expect(r.rain_forecast_mm).toBe(16); // day 2 sample 6 + 10
  expect(r.rain_mm_7d).toBe(Math.round(((20 * 5) / 7 + (10 + 10) + (28 + 10)) * 10) / 10);
  expect(horizonInputs(0, 200).rain_forecast_mm).toBe(80); // capped at the training range
  expect(horizonInputs(6, 100).rain_mm_7d).toBeLessThanOrEqual(80);
});

it("an out-of-range day is clamped", () => {
  expect(horizonInputs(99, 0).days_added).toBe(DAYS.length - 1);
  expect(horizonInputs(-1, 0).days_added).toBe(0);
});
