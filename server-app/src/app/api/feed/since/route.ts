import { getTripsSince } from "@/data/trips";
import { jsonError, requireApiUser } from "@/lib/api-auth";

export async function GET(req: Request) {
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;

  const sp = new URL(req.url).searchParams;
  const since = new Date(sp.get("since") ?? "");
  if (Number.isNaN(since.getTime())) return jsonError("Invalid date", 400);
  const now = new Date().toISOString(); // taken before the query so nothing falls between two refreshes
  return Response.json({ trips: await getTripsSince(since, sp.get("city") || undefined), now });
}
