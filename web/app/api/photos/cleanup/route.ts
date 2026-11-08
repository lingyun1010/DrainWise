// Daily clean-up of expired public-demo photos. Vercel Cron calls this with
// `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET set, the route does not exist.
import { connection } from "next/server";
import { deleteExpired } from "@/lib/photoStore";

export async function GET(request: Request) {
  await connection();
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Not found", { status: 404 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return Response.json({ removed: await deleteExpired() });
}
