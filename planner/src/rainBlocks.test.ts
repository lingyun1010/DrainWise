import { expect, it } from "vitest";
import { PATTERN_3H, rainBlocks, unitFor } from "./rainBlocks";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

it("the pattern sums to 1", () => {
  expect(sum(PATTERN_3H)).toBeCloseTo(1, 10);
});

it("one day from 09:00 has the blocks left today, and they add up to today's rain", () => {
  const b = rainBlocks({ dayRain: [6, 20], days: 1, extraMm: 0, nowHour: 9, unitHours: 3 });
  expect(b.map((x) => x.hour)).toEqual([9, 12, 15, 18, 21]);
  expect(sum(b.map((x) => x.baseMm))).toBeCloseTo(6, 10);
  expect(b.at(-1)!.cumMm).toBeCloseTo(6, 10);
});

it("two days add a full second day (8 blocks) and the running total never drops", () => {
  const b = rainBlocks({ dayRain: [6, 20], days: 2, extraMm: 0, nowHour: 9, unitHours: 3 });
  expect(b).toHaveLength(5 + 8);
  expect(b.at(-1)!.cumMm).toBeCloseTo(26, 10);
  for (let i = 1; i < b.length; i++) expect(b[i].cumMm).toBeGreaterThanOrEqual(b[i - 1].cumMm);
  expect(b[5].dayIdx).toBe(1);
  expect(b[5].hour).toBe(0);
});

it("extra rain is spread over the period and added to the running total", () => {
  const b = rainBlocks({ dayRain: [6, 20], days: 2, extraMm: 10, nowHour: 9, unitHours: 3 });
  expect(sum(b.map((x) => x.extraMm))).toBeCloseTo(10, 10);
  expect(b.at(-1)!.cumMm).toBeCloseTo(36, 10);
});

it("long periods use 6-hour blocks that cover the same rain", () => {
  expect(unitFor(3)).toBe(3);
  expect(unitFor(4)).toBe(6);
  const b = rainBlocks({ dayRain: [1, 2, 3, 4, 5, 6], days: 6, extraMm: 0, nowHour: 22, unitHours: 6 });
  expect(b.at(-1)!.cumMm).toBeCloseTo(21, 10);
  expect(b.filter((x) => x.dayIdx === 1)).toHaveLength(4);
});

it("works at midnight and with no rain", () => {
  const b = rainBlocks({ dayRain: [0], days: 1, extraMm: 0, nowHour: 0, unitHours: 3 });
  expect(b).toHaveLength(8);
  expect(b.at(-1)!.cumMm).toBe(0);
});
