import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  allowRequest,
  checkPhotoBytes,
  cleanId,
  expiryFor,
  parseKind,
  photoPath,
} from "./photoUpload";

const jpeg = (n: number) => {
  const b = new Uint8Array(n);
  b.set([0xff, 0xd8, 0xff]);
  return b;
};

describe("checkPhotoBytes", () => {
  it("accepts a small JPEG", () => {
    expect(checkPhotoBytes(jpeg(500)).ok).toBe(true);
  });
  it("rejects an empty file", () => {
    expect(checkPhotoBytes(new Uint8Array())).toMatchObject({ ok: false, status: 400 });
  });
  it("rejects a file over 3 MB", () => {
    expect(checkPhotoBytes(jpeg(MAX_PHOTO_BYTES + 1))).toMatchObject({ ok: false, status: 413 });
  });
  it("rejects a PNG even if it is small", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    expect(checkPhotoBytes(png)).toMatchObject({ ok: false, status: 415 });
  });
});

describe("ids and kind", () => {
  it("accepts plain ids and rejects path tricks", () => {
    expect(cleanId("run-12_a")).toBe("run-12_a");
    expect(cleanId("../etc")).toBeNull();
    expect(cleanId("a/b")).toBeNull();
    expect(cleanId("")).toBeNull();
    expect(cleanId("x".repeat(65))).toBeNull();
    expect(cleanId(42)).toBeNull();
  });
  it("only knows before and after", () => {
    expect(parseKind("before")).toBe("before");
    expect(parseKind("after")).toBe("after");
    expect(parseKind("during")).toBeNull();
  });
  it("builds a path from checked parts", () => {
    expect(photoPath("r1", "GPT-014", "before", "u")).toBe("r1/GPT-014/before-u.jpg");
  });
});

describe("expiryFor", () => {
  it("expires public uploads after 24 hours and keeps local ones", () => {
    expect(expiryFor(0, true)).toBe("1970-01-02T00:00:00.000Z");
    expect(expiryFor(0, false)).toBeNull();
  });
});

describe("allowRequest", () => {
  it("blocks after the limit and allows again after the window", () => {
    const hits = new Map<string, number[]>();
    for (let i = 0; i < 3; i++) expect(allowRequest(hits, "ip", i, 3, 1000)).toBe(true);
    expect(allowRequest(hits, "ip", 10, 3, 1000)).toBe(false);
    expect(allowRequest(hits, "ip", 2000, 3, 1000)).toBe(true);
    expect(allowRequest(hits, "other", 10, 3, 1000)).toBe(true);
  });
});
