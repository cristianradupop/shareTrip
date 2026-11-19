import { getTripsSince } from "@/data/trips";
import { getApiSession, jsonError } from "@/lib/api-auth";
import { feedViewer, parseFeedCity } from "@/lib/feed-params";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const since = new Date(sp.get("since") ?? "");
  if (Number.isNaN(since.getTime())) return jsonError("Invalid date", 400);
  const city = parseFeedCity(sp.get("city"));
  if (!city.ok) return jsonError("Invalid city", 400);

  const session = await getApiSession(req);
  const now = new Date().toISOString(); // taken before the query so nothing falls between two refreshes
  const trips = await getTripsSince(since, city.city, {
    excludeOrganizerId: session?.user.id,
    viewer: session ? feedViewer(session.user) : undefined,
  });
  return Response.json({ trips, now }, { headers: NO_STORE });
}
