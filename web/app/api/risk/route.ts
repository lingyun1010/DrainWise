// Proxies to the Python risk-api so the browser never needs its address.
const RISK_API_URL = process.env.RISK_API_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  const body = await request.json();
  try {
    const res = await fetch(`${RISK_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return Response.json({ error: `risk-api returned ${res.status}` }, { status: 502 });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "risk-api is not reachable" }, { status: 502 });
  }
}
