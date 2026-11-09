// Guards and sending for the report email. The transport is passed in, so tests use a mock SMTP transport and the
// real route passes a nodemailer Gmail transport. The recipient is never stored; only a masked form is logged.

export type Mail = { from: string; to: string; subject: string; text: string };
export type Transport = { sendMail(mail: Mail): Promise<unknown> };

const ADDRESS =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

// One plain address, no spaces, commas or line breaks (so no extra recipients or header tricks).
export function validAddress(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length <= 254 && ADDRESS.test(raw);
}

// a***@gmail.com
export function maskAddress(addr: string): string {
  const at = addr.lastIndexOf("@");
  return at < 1 ? "***" : `${addr[0]}***${addr.slice(at)}`;
}

// Sliding one-hour window per key, in memory (per server instance; fine for a demo, a shared store would be needed in production).
export function makeLimiter(perHour: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return (key: string): boolean => {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((h) => t - h < 3_600_000);
    if (recent.length >= perHour) {
      hits.set(key, recent);
      return false;
    }
    recent.push(t);
    hits.set(key, recent);
    return true;
  };
}

export type SendEnv = Record<string, string | undefined>;

// null = sending is allowed. Otherwise the HTTP status and message to return.
export function sendBlocked(env: SendEnv): { status: number; error: string } | null {
  if (env.REPORT_EMAIL_OFF === "1") return { status: 503, error: "Sending is switched off (kill switch)." };
  if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) return { status: 503, error: "Email is not set up on this server." };
  return null;
}

export async function sendReportMail(
  transport: Transport,
  from: string,
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  await transport.sendMail({ from, to, subject, text });
}
