import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CAMERA_NETS } from "./cameraNets";

// The polygons are copied from ml/synth_images.py; this fails if the two drift.
describe("CAMERA_NETS", () => {
  it("matches CAMERAS in ml/synth_images.py", () => {
    const py = readFileSync(new URL("../../ml/synth_images.py", import.meta.url), "utf8");
    const polys = [...py.matchAll(/"poly": \[((?:\(\d+, \d+\),? ?)+)\]/g)].map((m) =>
      [...m[1].matchAll(/\((\d+), (\d+)\)/g)].map((p) => [Number(p[1]), Number(p[2])]),
    );
    expect(polys).toHaveLength(7);
    polys.forEach((p, i) => expect(CAMERA_NETS[`cam-0${i + 1}`]).toEqual(p));
  });
});
