import { createHash } from "node:crypto";
import { isTrackedPath, normalizePath, type AnalyticsBatch } from "@/shared/analytics";

export type Device = "mobile" | "tablet" | "desktop";
export type Browser = "Chrome" | "Edge" | "Firefox" | "Safari" | "Opera" | "Samsung" | "Other";

export function hashIp(ip: string, salt: string): string {
  return createHash("sha256").update(`${salt}|${ip}`).digest("hex");
}

export function parseUserAgent(ua: string): { device: Device; browser: Browser; bot: boolean } {
  const bot = /bot|crawler|spider|slurp|headless|preview/i.test(ua);
  let device: Device = "desktop";
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) device = "tablet";
  else if (/iPhone|iPod|Mobile/i.test(ua)) device = "mobile";

  let browser: Browser = "Other";
  if (/SamsungBrowser/i.test(ua)) browser = "Samsung";
  else if (/Edg(e|A|iOS)?\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = "Firefox";
  else if (/Chrome\/|CriOS\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari";
  return { device, browser, bot };
}

const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

/** Only a hostname is kept from a referrer: no path, query or credentials. Anything else is null. */
export function referrerHost(value: string | undefined): string | null {
  if (!value) return null;
  const candidate = value.trim();
  if (HOSTNAME.test(candidate)) return candidate.toLowerCase();
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return HOSTNAME.test(url.hostname) ? url.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function toEventRows(batch: AnalyticsBatch, meta: { ipHash: string; signedIn: boolean; ua: string }) {
  const { device, browser } = parseUserAgent(meta.ua);
  return batch.events
    .filter((e) => isTrackedPath(e.path))
    .map((e) => ({
      type: e.type,
      visitorId: batch.visitorId,
      sessionId: batch.sessionId,
      ipHash: meta.ipHash,
      signedIn: meta.signedIn,
      path: normalizePath(e.path),
      referrer: e.type === "pageview" ? referrerHost(e.referrer) : null,
      language: e.type === "pageview" ? (e.language ?? null) : null,
      screen: e.type === "pageview" ? (e.screen ?? null) : null,
      device,
      browser,
      name:
        e.type === "click" ? e.target
        : e.type === "interaction" || e.type === "vital" ? e.name
        : e.type === "api" ? `${e.method} ${normalizePath(e.apiPath)}`
        : null,
      status: e.type === "api" ? e.status : null,
      value:
        e.type === "leave" || e.type === "api" ? e.durationMs
        : e.type === "vital" ? e.value
        : null,
    }));
}
