// Proxies to the Python risk-api so the browser never needs its address.
// Not available on the public build: it has no risk-api, so the page scores in the browser (planner/src/riskModel.ts).
const RISK_API_URL = process.env.RISK_API_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request) {
  if (process.env.NEXT_PUBLIC_PUBLIC_BUILD === "1") {
    return Response.json({ error: "risk-api is off on the public build" }, { status: 404 });
  }
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
