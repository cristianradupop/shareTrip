import { getFeed } from "@/data/trips";
import { requireApiUser } from "@/lib/api-auth";

export async function GET(req: Request) {
  const guard = await requireApiUser(req);
  if (!guard.ok) return guard.response;

  const sp = new URL(req.url).searchParams;
  const city = sp.get("city") || undefined;
  const cursor = sp.get("cursor") || undefined;
  const sort = sp.get("sort") === "desc" ? "desc" : "asc";
  return Response.json(await getFeed({ city, sort, cursor }));
}
