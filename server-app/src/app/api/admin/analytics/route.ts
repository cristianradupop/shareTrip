import { getAnalyticsReport } from "@/data/analytics";
import { jsonError, requireApiAdmin } from "@/lib/api-auth";
import { ANALYTICS_RANGES } from "@/shared/analytics";

export async function GET(req: Request) {
  const guard = await requireApiAdmin(req);
  if (!guard.ok) return guard.response;

  const range = ANALYTICS_RANGES.find((r) => r === new URL(req.url).searchParams.get("range"));
  if (!range) return jsonError("Unknown range", 400);
  return Response.json(await getAnalyticsReport(range, new Date()), { headers: { "Cache-Control": "private, no-store" } });
}
