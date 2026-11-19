import { getAdminStats } from "@/data/admin";
import { requireApiAdmin } from "@/lib/api-auth";

export async function GET(req: Request) {
  const guard = await requireApiAdmin(req);
  if (!guard.ok) return guard.response;
  return Response.json(await getAdminStats(), { headers: { "Cache-Control": "private, no-store" } });
}
