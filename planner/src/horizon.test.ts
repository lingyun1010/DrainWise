import { expect, it } from "vitest";
import { DAYS, horizonInputs } from "./horizon";

it("Today with no extra rain is the default scenario (rain 20 mm, forecast 10 mm)", () => {
  expect(horizonInputs(0, 0)).toEqual({ days_added: 0, rain_mm_7d: 20, rain_forecast_mm: 10 });
});

it("each later day adds a day since clean and the rain that fell in between", () => {
  expect(horizonInputs(1, 0)).toEqual({ days_added: 1, rain_mm_7d: 30, rain_forecast_mm: 28 });
  expect(horizonInputs(2, 0)).toEqual({ days_added: 2, rain_mm_7d: 58, rain_forecast_mm: 6 });
});

it("extra rain raises forecast rain and is capped at the training range", () => {
  expect(horizonInputs(0, 100).rain_forecast_mm).toBe(80);
  expect(horizonInputs(1, 100).rain_forecast_mm).toBe(80);
  expect(horizonInputs(3, 0).rain_mm_7d).toBeLessThanOrEqual(80);
});

it("an out-of-range day is clamped", () => {
  expect(horizonInputs(99, 0).days_added).toBe(DAYS.length - 1);
  expect(horizonInputs(-1, 0).days_added).toBe(0);
});
