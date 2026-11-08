import { describe, expect, it } from "vitest";
import { MAX_ROOM_BYTES, ROOM_ALPHABET, checkRoomState, cleanRoomCode, generateRoomCode, roomExpiry } from "./roomCode";

const good = { crews: [], runs: {}, records: [], log: [] };

describe("room codes", () => {
  it("generates 4 letters from the safe alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(4);
      for (const ch of code) expect(ROOM_ALPHABET).toContain(ch);
    }
  });

  it("does not use I, L or O", () => {
    expect(ROOM_ALPHABET).not.toMatch(/[ILO]/);
  });

  it("cleans what a person types", () => {
    expect(cleanRoomCode(" abcd ")).toBe("ABCD");
    expect(cleanRoomCode("ab-cd")).toBe("ABCD");
  });

  it("rejects wrong length, banned letters and non-strings", () => {
    expect(cleanRoomCode("ABC")).toBeNull();
    expect(cleanRoomCode("ABCDE")).toBeNull();
    expect(cleanRoomCode("ABCI")).toBeNull();
    expect(cleanRoomCode("AB1D")).toBeNull();
    expect(cleanRoomCode(1234)).toBeNull();
    expect(cleanRoomCode(null)).toBeNull();
  });
});

describe("checkRoomState", () => {
  it("accepts the session shape", () => {
    expect(checkRoomState(good)).toEqual({ ok: true });
  });

  it("rejects things that are not a session", () => {
    expect(checkRoomState(null).ok).toBe(false);
    expect(checkRoomState([]).ok).toBe(false);
    expect(checkRoomState({ ...good, crews: {} }).ok).toBe(false);
    expect(checkRoomState({ ...good, runs: [] }).ok).toBe(false);
    expect(checkRoomState({ crews: [], runs: {}, records: [] }).ok).toBe(false);
  });

  it("rejects a session over the size cap with 413", () => {
    const big = { ...good, log: [{ t: "x", x: "y".repeat(MAX_ROOM_BYTES) }] };
    expect(checkRoomState(big)).toMatchObject({ ok: false, status: 413 });
  });
});

describe("roomExpiry", () => {
  it("is 24 hours after now", () => {
    expect(roomExpiry(0)).toBe("1970-01-02T00:00:00.000Z");
  });
});
