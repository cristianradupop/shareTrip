import { getOrganizerStats } from "@/data/trips";
import { requireApiUser } from "@/lib/api-auth";

export async function GET(req: Request) {
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;
  return Response.json({ stats: await getOrganizerStats(guard.user.id) });
}
