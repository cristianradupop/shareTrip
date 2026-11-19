import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { session, user } from "@/db/schema";
import { accountSubject, buildEvent, recordEvent } from "@/lib/audit";
import { checkSameOrigin, jsonError, readJson, requireApiAdmin, requireJson } from "@/lib/api-auth";

const banSchema = z.object({ banned: z.boolean(), reason: z.string().optional() });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const guard = await requireApiAdmin(req);
  if (!guard.ok) return guard.response;
  const notJson = requireJson(req);
  if (notJson) return notJson;
  const { id } = await ctx.params;

  const parsed = banSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Invalid data", 400);
  const { banned, reason } = parsed.data;
  if (id === guard.user.id) return jsonError("You cannot ban yourself", 400);

  const banReason = banned ? reason?.slice(0, 200) || "Banned by an administrator" : null;
  const found = await db.transaction(async (tx) => {
    const [target] = await tx.select().from(user).where(eq(user.id, id)).for("update");
    if (!target) return false;
    await tx.update(user).set({ banned, banReason, banExpires: null }).where(eq(user.id, id));
    if (banned) await tx.delete(session).where(eq(session.userId, id)); // log them out everywhere
    // Already in that state (and, for a ban, with the same reason): nothing to log.
    const unchanged = Boolean(target.banned) === banned && (!banned || target.banReason === banReason);
    if (unchanged) return true;
    const actor = { id: guard.user.id, name: guard.user.name, role: "admin" as const };
    await recordEvent(
      tx,
      buildEvent(banned ? "account.banned" : "account.unbanned", actor, accountSubject(target), {
        reason: banned ? (banReason ?? undefined) : undefined,
      }),
    );
    return true;
  });
  if (!found) return jsonError("User not found", 404);
  return Response.json({ ok: true });
}
