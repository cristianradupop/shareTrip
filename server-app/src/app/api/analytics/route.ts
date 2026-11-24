import { getSessionCookie } from "better-auth/cookies";
import { checkSameOrigin, jsonError, requireJson } from "@/lib/api-auth";
import { hashIp, parseUserAgent, toEventRows } from "@/lib/analytics";
import { consumeAnalyticsAttempt } from "@/lib/analytics-limit";
import { clientIp } from "@/lib/client-ip";
import { getDailySalt, insertAnalyticsEvents, pruneAnalytics } from "@/data/analytics";
import { CONSENT_COOKIE, analyticsBatchSchema, parseConsent, readCookie } from "@/shared/analytics";

const MAX_BODY_BYTES = 65536;
const noContent = () => new Response(null, { status: 204 });

/**
 * Public first-party analytics ingest. Access is the consent cookie only: without it nothing is read or stored.
 * No raw IP or user agent is stored: the IP becomes a hash salted per UTC day.
 */
export async function POST(req: Request) {
  const crossOrigin = checkSameOrigin(req);
  if (crossOrigin) return crossOrigin;
  const notJson = requireJson(req);
  if (notJson) return notJson;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return jsonError("Payload too large", 413);

  const consent = parseConsent(readCookie(req.headers.get("cookie"), CONSENT_COOKIE));
  if (!consent?.analytics) return noContent();

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return jsonError("Payload too large", 413);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return jsonError("Invalid data", 400);
  }
  const parsed = analyticsBatchSchema.safeParse(json);
  if (!parsed.success) return jsonError("Invalid data", 400);

  const now = new Date();
  const salt = await getDailySalt(now);
  const verdict = await consumeAnalyticsAttempt(req, parsed.data.events.length, { salt });
  if (!verdict.allowed) {
    if (verdict.scope === "global") return noContent();
    return Response.json(
      { ok: false, error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(verdict.retryAfterSeconds) } },
    );
  }

  const ua = req.headers.get("user-agent") ?? "";
  if (parseUserAgent(ua).bot) return noContent();

  const rows = toEventRows(parsed.data, {
    ipHash: hashIp(clientIp(req) ?? "unknown", salt),
    signedIn: getSessionCookie(req) !== null,
    ua,
  });
  await insertAnalyticsEvents(rows);
  await pruneAnalytics(now);
  return noContent();
}
