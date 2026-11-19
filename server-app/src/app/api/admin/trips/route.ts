import { listAllTrips } from "@/data/admin";
import { requireApiAdmin } from "@/lib/api-auth";

const STATUSES = ["active", "full", "cancelled"] as const;

export async function GET(req: Request) {
  const guard = await requireApiAdmin(req);
  if (!guard.ok) return guard.response;

  const sp = new URL(req.url).searchParams;
  const page = Math.min(10_000, Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1));
  const q = sp.get("q")?.slice(0, 100) || undefined;
  const status = STATUSES.find((s) => s === sp.get("status"));
  return Response.json(await listAllTrips({ q, status, page }), { headers: { "Cache-Control": "private, no-store" } });
}
