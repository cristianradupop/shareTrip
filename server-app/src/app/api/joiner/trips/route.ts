import { getJoinerTrips } from "@/data/trips";
import { getJoinerRequests } from "@/data/requests";
import { requireApiUser } from "@/lib/api-auth";

export async function GET(req: Request) {
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;

  const [trips, requests] = await Promise.all([
    getJoinerTrips(guard.user.id),
    getJoinerRequests(guard.user.id),
  ]);
  return Response.json({ trips, requests });
}
