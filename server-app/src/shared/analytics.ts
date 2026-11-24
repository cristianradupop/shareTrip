// First-party analytics contract shared by server-app and server-admin.
// Only zod, types and pure functions: server-admin type-checks this file with its own alias.
import { z } from "zod";

export const CONSENT_COOKIE = "tt_consent";
export const CONSENT_VERSION = 1;
export const VISITOR_COOKIE = "tt_vid";
export const SESSION_COOKIE = "tt_sid";
export const CONSENT_MAX_AGE_SECONDS = 15552000;
export const SESSION_IDLE_SECONDS = 1800;

export function formatConsent(analytics: boolean): string {
  return `${CONSENT_VERSION}.${analytics ? "granted" : "denied"}`;
}

export function parseConsent(raw?: string): { analytics: boolean } | null {
  if (raw === `${CONSENT_VERSION}.granted`) return { analytics: true };
  if (raw === `${CONSENT_VERSION}.denied`) return { analytics: false };
  return null;
}

export function readCookie(header: string | null | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_SEGMENT = /^\d+$/;
const LONG_ID_SEGMENT = /^[A-Za-z0-9]{16,}$/;

export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0] || "/";
  return clean
    .split("/")
    .map((seg) => {
      if (UUID_SEGMENT.test(seg) || NUMERIC_SEGMENT.test(seg)) return ":id";
      if (LONG_ID_SEGMENT.test(seg) && /\d/.test(seg)) return ":id";
      return seg;
    })
    .join("/");
}

export function isTrackedPath(path: string): boolean {
  const clean = path.split(/[?#]/)[0];
  return clean !== "/admin" && !clean.startsWith("/admin/");
}

export const ANALYTICS_EVENT_TYPES = ["pageview", "leave", "click", "interaction", "api", "vital"] as const;
export const INTERACTIONS = ["signup", "login", "trip_created", "trip_edited", "join_request_sent"] as const;
export const WEB_VITALS = ["LCP", "INP", "CLS", "TTFB", "FCP"] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];
export type Interaction = (typeof INTERACTIONS)[number];
export type WebVital = (typeof WEB_VITALS)[number];

/** [good up to, needs-improvement up to]; anything above is poor. */
export const WEB_VITAL_THRESHOLDS: Record<WebVital, readonly [number, number]> = {
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25],
  TTFB: [800, 1800],
  FCP: [1800, 3000],
};

export function vitalRating(name: WebVital, value: number): "good" | "needs-improvement" | "poor" {
  const [good, mid] = WEB_VITAL_THRESHOLDS[name];
  if (value <= good) return "good";
  if (value <= mid) return "needs-improvement";
  return "poor";
}

export const ANALYTICS_MAX_BATCH = 50;

const path = z.string().min(1).max(300);
const short = (max: number) => z.string().max(max);

const analyticsEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("pageview"),
    path,
    referrer: short(300).optional(),
    language: short(35).optional(),
    screen: short(20).optional(),
  }),
  z.object({ type: z.literal("leave"), path, durationMs: z.number().finite().min(0).max(86_400_000) }),
  z.object({ type: z.literal("click"), path, target: z.string().min(1).max(100) }),
  z.object({ type: z.literal("interaction"), path, name: z.enum(INTERACTIONS) }),
  z.object({
    type: z.literal("api"),
    path,
    method: z.string().min(1).max(10),
    apiPath: path,
    status: z.number().int().min(0).max(599),
    durationMs: z.number().finite().min(0).max(3_600_000),
  }),
  z.object({ type: z.literal("vital"), path, name: z.enum(WEB_VITALS), value: z.number().finite().min(0) }),
]);

export const analyticsBatchSchema = z.object({
  visitorId: z.string().uuid(),
  sessionId: z.string().uuid(),
  events: z.array(analyticsEventSchema).min(1).max(ANALYTICS_MAX_BATCH),
});

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsBatch = z.infer<typeof analyticsBatchSchema>;

export const ANALYTICS_RANGES = ["today", "7d", "30d"] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

type Count = { label: string; count: number };

export type AnalyticsReport = {
  range: AnalyticsRange;
  totals: { visitors: number; sessions: number; pageviews: number; signedInShare: number; avgDurationMs: number | null };
  daily: { day: string; visitors: number; uniqueIps: number; pageviews: number }[];
  topPages: { path: string; views: number; visitors: number; avgDurationMs: number | null }[];
  referrers: Count[];
  devices: Count[];
  browsers: Count[];
  clicks: Count[];
  interactions: Count[];
  api: { apiPath: string; method: string; calls: number; errors: number; p50Ms: number | null; p95Ms: number | null }[];
  vitals: { name: WebVital; samples: number; p75: number | null; rating: "good" | "needs-improvement" | "poor" | null }[];
};
