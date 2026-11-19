import { z } from "zod";
import { getTripOwner, listTripPeople } from "@/data/requests";
import { jsonError, requireApiUser } from "@/lib/api-auth";

type Ctx = { params: Promise<{ id: string }> };

/** Pending requests and members of one of the caller's trips. Only the trip's organizer (not admins) may read it. */
export async function GET(req: Request, ctx: Ctx) {
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError("Trip not found", 404);
  if ((await getTripOwner(id)) !== guard.user.id) return jsonError("Trip not found", 404);

  const people = await listTripPeople(id, new Date().toISOString().slice(0, 10));
  return Response.json(people, { headers: { "Cache-Control": "private, no-store" } });
}
