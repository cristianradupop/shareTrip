import { getApiSession } from "@/lib/api-auth";
import type { SessionUser } from "@/shared/types";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(req: Request) {
  const session = await getApiSession(req);
  if (!session) return Response.json({ user: null }, { headers: NO_STORE });
  const u = session.user as typeof session.user & Partial<SessionUser>;
  const user: SessionUser = {
    id: u.id,
    username: u.username ?? null,
    email: u.email,
    firstName: u.firstName ?? "",
    lastName: u.lastName ?? "",
    phone: u.phone ?? "",
    address: u.address ?? "",
    birthDate: u.birthDate ?? "",
    gender: u.gender === "male" || u.gender === "female" ? u.gender : null,
    image: u.image ?? null,
    role: u.role === "admin" ? "admin" : "user",
  };
  return Response.json({ user }, { headers: NO_STORE });
}
