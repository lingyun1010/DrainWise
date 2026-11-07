import { describe, it, expect } from "vitest";
import { canComplete } from "./canComplete";

describe("canComplete (crew submit rule)", () => {
  it("camera site completes directly, no photos needed", () => {
    expect(canComplete({ hasCamera: true }, {})).toEqual({ ok: true, missing: [] });
  });

  it("non-camera site with no photos is blocked, missing both", () => {
    expect(canComplete({ hasCamera: false }, {})).toEqual({ ok: false, missing: ["before", "after"] });
  });

  it("only the after photo is reported missing when the before photo exists", () => {
    expect(canComplete({ hasCamera: false }, { before: "b.jpg" })).toEqual({ ok: false, missing: ["after"] });
  });

  it("non-camera site with both photos can be submitted", () => {
    expect(canComplete({ hasCamera: false }, { before: "b.jpg", after: "a.jpg" })).toEqual({ ok: true, missing: [] });
  });
});
