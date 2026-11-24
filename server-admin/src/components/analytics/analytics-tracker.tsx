"use client";

import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { useEffect } from "react";
import { normalizePath, WEB_VITALS, type WebVital } from "server-app/shared";
import { useConsent } from "@/components/consent/consent-provider";
import { describeClickTarget, endPageView, flush, setAnalyticsEnabled, startPageView, track, trackVital } from "@/lib/analytics";

/** Host of the page that linked here, or undefined for direct visits and our own pages. */
function externalReferrer(): string | undefined {
  try {
    const url = new URL(document.referrer);
    return url.origin === location.origin ? undefined : url.hostname;
  } catch {
    return undefined;
  }
}

// Only the first page view of a document load can have an external referrer; later ones are client-side navigations.
let referrerSent = false;

// Module-level so the reference never changes: Next replays the metrics so far to every new callback.
const reportVital: Parameters<typeof useReportWebVitals>[0] = (metric) => {
  const name = metric.name as WebVital;
  if (!WEB_VITALS.includes(name)) return;
  trackVital(metric.id, { type: "vital", path: normalizePath(location.pathname), name, value: metric.value });
};

/** Feeds the collector: page views, time on page, clicks and web vitals. Renders nothing. */
export function AnalyticsTracker() {
  const { analytics } = useConsent();
  const pathname = usePathname();

  // Declared first so a switch-off drops the queue after the page effect's cleanup has run.
  useEffect(() => {
    setAnalyticsEnabled(analytics);
  }, [analytics]);

  useEffect(() => {
    if (!analytics) return;
    const path = normalizePath(pathname);
    const referrer = referrerSent ? undefined : externalReferrer();
    referrerSent = true;
    startPageView(path);
    track({
      type: "pageview",
      path,
      referrer,
      language: navigator.language,
      screen: `${screen.width}x${screen.height}`,
    });
    const onHide = () => {
      endPageView();
      void flush({ keepalive: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
      else startPageView(path);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onHide);
      endPageView();
    };
  }, [analytics, pathname]);

  useEffect(() => {
    if (!analytics) return;
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest("a,button,[data-track]") : null;
      if (!el) return;
      track({
        type: "click",
        path: normalizePath(location.pathname),
        target: describeClickTarget({
          tag: el.tagName.toLowerCase(),
          dataTrack: el.getAttribute("data-track"),
          href: el.getAttribute("href"),
          text: el.textContent,
        }),
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [analytics]);

  useReportWebVitals(reportVital);

  return null;
}
