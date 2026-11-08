// Rain over the chosen period as 3-hour blocks (or 6-hour blocks when the period is long), plus a running total.
// BoM's free forecast only gives a total per day. The daily totals are real; HOW the day's rain is spread across its
// 3-hour blocks is an ASSUMPTION (a fixed sample pattern, most rain in the afternoon). The page says so.

export const PATTERN_3H = [0.04, 0.06, 0.1, 0.18, 0.26, 0.2, 0.1, 0.06]; // sums to 1, blocks 00:00 to 21:00

export type RainBlock = {
  dayIdx: number; // 0 = today
  hour: number; // start hour of the block, 0 to 21
  baseMm: number; // forecast rain (BoM daily total, spread)
  extraMm: number; // what-if rain added by the Extra rain slider
  cumMm: number; // running total up to the end of this block
};

// The first day is only the rest of today (from the current 3-hour block). Later days are whole days.
export function rainBlocks(opts: {
  dayRain: readonly number[]; // mm per day, today first
  days: number; // how many days from today, 1 or more
  extraMm: number; // extra mm over the whole period, shared evenly between the days
  nowHour: number; // Sydney hour now, 0 to 23
  unitHours: 3 | 6;
}): RainBlock[] {
  const { dayRain, days, extraMm, nowHour, unitHours } = opts;
  const per = unitHours / 3; // 3-hour blocks per output block
  const share = Math.max(0, extraMm) / days;
  const out: RainBlock[] = [];
  let cum = 0;
  for (let d = 0; d < days; d++) {
    const first3 = d === 0 ? Math.min(7, Math.max(0, Math.floor(nowHour / 3))) : 0;
    const weights = PATTERN_3H.map((w, i) => (i >= first3 ? w : 0));
    const total = weights.reduce((a, b) => a + b, 0);
    for (let b = Math.floor(first3 / per) * per; b < 8; b += per) {
      const w = weights.slice(b, b + per).reduce((a, c) => a + c, 0) / total;
      const base = (dayRain[d] ?? 0) * w;
      const extra = share * w;
      cum += base + extra;
      out.push({ dayIdx: d, hour: b * 3, baseMm: base, extraMm: extra, cumMm: cum });
    }
  }
  return out;
}

// Short blocks for a short period, longer blocks when the period gets long.
export const unitFor = (days: number): 3 | 6 => (days <= 3 ? 3 : 6);
