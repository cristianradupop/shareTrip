import {
  ANALYTICS_MAX_BATCH,
  CONSENT_MAX_AGE_SECONDS,
  isTrackedPath,
  normalizePath,
  readCookie,
  SESSION_COOKIE,
  SESSION_IDLE_SECONDS,
  VISITOR_COOKIE,
  type AnalyticsEvent,
  type Interaction,
} from "server-app/shared";

// Browser-side collector. Safe to import in node/SSR: nothing touches the browser until an event is tracked.
// Nothing is queued, and no cookie is written, unless setAnalyticsEnabled(true) was called (analytics consent).

const FLUSH_INTERVAL_MS = 5000;
const FLUSH_AT = 20;
const ENDPOINT = "/api/analytics";

let enabled = false;
let queue: AnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
const pendingVitals = new Map<string, Extract<AnalyticsEvent, { type: "vital" }>>();
const sentVitals = new Set<string>();
let currentView: { path: string; start: number } | null = null;

export function setAnalyticsEnabled(value: boolean): void {
  enabled = value;
  if (!value) {
    queue = [];
    pendingVitals.clear();
    currentView = null;
    if (timer) clearTimeout(timer);
    timer = null;
  }
}

/** Short, query-free label of a clicked element. `data-track` wins over the link path, which wins over the label. */
export function describeClickTarget(el: { tag: string; dataTrack?: string | null; href?: string | null; text?: string | null }): string {
  if (el.dataTrack) return el.dataTrack.slice(0, 100);
  if (el.href) {
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(el.href);
    if (scheme && !/^https?$/i.test(scheme[1])) return `${el.tag} ${scheme[0].toLowerCase()}`.slice(0, 100);
    if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(el.href)) {
      try {
        return `${el.tag} ${new URL(el.href, "http://localhost").hostname}`.slice(0, 100);
      } catch {
        return el.tag;
      }
    }
    const path = normalizePath(el.href.split(/[?#]/)[0] || "/");
    return `${el.tag} ${path}`.slice(0, 100);
  }
  return `${el.tag} ${(el.text ?? "").trim().replace(/\s+/g, " ").slice(0, 40)}`.trim();
}

function newId(): string {
  return crypto.randomUUID();
}

function writeCookie(name: string, value: string, maxAge: number): void {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
}

function ids(): { visitorId: string; sessionId: string } {
  const visitorId = readCookie(document.cookie, VISITOR_COOKIE) ?? newId();
  const sessionId = readCookie(document.cookie, SESSION_COOKIE) ?? newId();
  writeCookie(VISITOR_COOKIE, visitorId, CONSENT_MAX_AGE_SECONDS);
  writeCookie(SESSION_COOKIE, sessionId, SESSION_IDLE_SECONDS); // sliding: every use extends the idle window
  return { visitorId, sessionId };
}

export function track(event: AnalyticsEvent): void {
  if (!enabled || typeof document === "undefined") return;
  if (!isTrackedPath(event.path)) return;
  if (event.type !== "leave" && !isTrackedPath(location.pathname)) return;
  queue.push(event);
  if (queue.length >= FLUSH_AT) {
    void flush({ keepalive: false });
  } else if (!timer) {
    timer = setTimeout(() => void flush({ keepalive: false }), FLUSH_INTERVAL_MS);
  }
}

/** Starts timing a page view; the matching leave is queued by endPageView. */
export function startPageView(path: string): void {
  if (!enabled) return;
  currentView = { path, start: performance.now() };
}

/** Queues one leave for the current page view and forgets it, so a second call (cleanup, then pagehide) is a no-op. */
export function endPageView(): void {
  if (!enabled || !currentView) return;
  const { path, start } = currentView;
  currentView = null;
  track({ type: "leave", path, durationMs: Math.round(performance.now() - start) });
}

/** One vital event per metric name per document: a repeat before the flush updates the queued value, a repeat after it is dropped. */
export function trackVital(_id: string, event: Extract<AnalyticsEvent, { type: "vital" }>): void {
  const id = event.name;
  if (!enabled || sentVitals.has(id)) return;
  const queued = pendingVitals.get(id);
  if (queued) {
    queued.value = event.value;
    return;
  }
  const copy = { ...event };
  pendingVitals.set(id, copy);
  track(copy);
}

export function trackInteraction(name: Interaction): void {
  if (typeof location === "undefined") return;
  track({ type: "interaction", path: normalizePath(location.pathname), name });
}

export function recordApiTiming(method: string, apiPath: string, status: number, ms: number): void {
  if (!enabled || typeof location === "undefined") return;
  const path = normalizePath(apiPath);
  if (path === ENDPOINT) return;
  track({ type: "api", path: normalizePath(location.pathname), method, apiPath: path, status, durationMs: ms });
}

export async function flush({ keepalive }: { keepalive: boolean }): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!enabled || queue.length === 0) return;
  for (const id of pendingVitals.keys()) sentVitals.add(id);
  pendingVitals.clear();
  const batches: AnalyticsEvent[][] = [];
  while (queue.length > 0) batches.push(queue.splice(0, ANALYTICS_MAX_BATCH));
  const { visitorId, sessionId } = ids();
  await Promise.all(
    batches.map((events) =>
      fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visitorId, sessionId, events }),
        keepalive,
      }).catch(() => undefined),
    ),
  );
}
