import { getFeed } from "@/data/trips";
import { getApiSession, jsonError } from "@/lib/api-auth";
import { feedViewer, parseFeedCity, parseFeedCursor } from "@/lib/feed-params";

const NO_STORE = { "Cache-Control": "private, no-store" };

// Public read: the session is optional and only used to hide the caller's own trips.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const city = parseFeedCity(sp.get("city"));
  if (!city.ok) return jsonError("Invalid city", 400);
  const rawCursor = sp.get("cursor");
  const cursor = parseFeedCursor(rawCursor);
  if (rawCursor && !cursor) return jsonError("Invalid cursor", 400);

  const session = await getApiSession(req);
  const now = new Date().toISOString(); // taken before the query so nothing falls between two refreshes
  const page = await getFeed({
    city: city.city,
    cursor: cursor ?? undefined,
    excludeOrganizerId: session?.user.id,
    viewer: session ? feedViewer(session.user) : undefined,
  });
  return Response.json({ ...page, now }, { headers: NO_STORE });
}
