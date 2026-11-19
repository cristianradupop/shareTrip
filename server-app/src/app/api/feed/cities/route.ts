import { getActiveCities } from "@/data/trips";
import { getApiSession } from "@/lib/api-auth";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(req: Request) {
  const session = await getApiSession(req);
  const cities = await getActiveCities({ excludeOrganizerId: session?.user.id });
  return Response.json({ cities }, { headers: NO_STORE });
}
