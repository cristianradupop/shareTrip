import { listEvents } from "@/data/audit";
import { jsonError, requireApiAdmin } from "@/lib/api-auth";

const VIEWS = ["account", "activity", "audit"] as const;

export async function GET(req: Request) {
  const guard = await requireApiAdmin(req);
  if (!guard.ok) return guard.response;

  const view = VIEWS.find((v) => v === new URL(req.url).searchParams.get("view"));
  if (!view) return jsonError("Unknown view", 400);
  return Response.json({ events: await listEvents(view) }, { headers: { "Cache-Control": "private, no-store" } });
}
