import { getOrganizerTrips } from "@/data/trips";
import { requireApiUser } from "@/lib/api-auth";

export async function GET(req: Request) {
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;

  const raw = Number.parseInt(new URL(req.url).searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 100) : undefined;
  return Response.json({ trips: await getOrganizerTrips(guard.user.id, limit) });
}
