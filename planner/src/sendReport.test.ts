import { describe, expect, it } from "vitest";
import {
  keyMatches,
  makeLimiter,
  maskAddress,
  sendBlocked,
  sendReportMail,
  validAddress,
  type Mail,
} from "./sendReport";

describe("address", () => {
  it("accepts one plain address and masks it", () => {
    expect(validAddress("alex@gmail.com")).toBe(true);
    expect(maskAddress("alex@gmail.com")).toBe("a***@gmail.com");
  });
  it("rejects lists, line breaks, spaces and junk", () => {
    for (const bad of ["a@b.com,c@d.com", "a@b.com\nBcc: x@y.com", "a b@c.com", "nope", "a@b", "", 5, null]) {
      expect(validAddress(bad)).toBe(false);
    }
  });
});

describe("limiter", () => {
  it("allows N per hour per key, then lets the window slide", () => {
    let t = 0;
    const ok = makeLimiter(2, () => t);
    expect([ok("a"), ok("a"), ok("a"), ok("b")]).toEqual([true, true, false, true]);
    t = 3_600_001;
    expect(ok("a")).toBe(true);
  });
});

describe("kill switch and setup", () => {
  it("returns 503 when switched off or not configured", () => {
    const ok = { GMAIL_USER: "u", GMAIL_APP_PASSWORD: "p", REPORT_ADMIN_KEY: "k" };
    expect(sendBlocked({ ...ok, REPORT_EMAIL_OFF: "1" })?.status).toBe(503);
    expect(sendBlocked({})?.status).toBe(503);
    expect(sendBlocked({ GMAIL_USER: "u", GMAIL_APP_PASSWORD: "p" })?.status).toBe(503); // no admin key
    expect(sendBlocked(ok)).toBeNull();
  });
});

describe("admin key", () => {
  it("matches only the exact key", () => {
    expect(keyMatches("secret", "secret")).toBe(true);
    for (const bad of ["secreT", "secre", "", null]) expect(keyMatches(bad, "secret")).toBe(false);
    expect(keyMatches("x", undefined)).toBe(false);
  });
});

describe("sendReportMail (mock SMTP transport)", () => {
  it("hands exactly one message to the transport", async () => {
    const sent: Mail[] = [];
    await sendReportMail({ sendMail: async (m) => void sent.push(m) }, "me@gmail.com", "you@example.com", "S", "B");
    expect(sent).toEqual([{ from: "me@gmail.com", to: "you@example.com", subject: "S", text: "B" }]);
  });
});
