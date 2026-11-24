import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_SECONDS,
  SESSION_COOKIE,
  VISITOR_COOKIE,
  formatConsent,
  parseConsent,
  readCookie,
} from "server-app/shared";

export type ConsentView = { showBanner: boolean; analytics: boolean; signalRespected: boolean };

/** Decides what the visitor sees. An explicit stored choice wins; a GPC/DNT signal alone means "no" without asking. */
export function consentView(input: { stored: string | undefined; gpc: boolean; dnt: boolean }): ConsentView {
  const choice = parseConsent(input.stored);
  const signal = input.gpc || input.dnt;
  if (choice) return { showBanner: false, analytics: choice.analytics, signalRespected: signal && !choice.analytics };
  if (signal) return { showBanner: false, analytics: false, signalRespected: true };
  return { showBanner: true, analytics: false, signalRespected: false };
}

export function readStoredConsent(): string | undefined {
  return readCookie(document.cookie, CONSENT_COOKIE);
}

export function browserSignals(): { gpc: boolean; dnt: boolean } {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return { gpc: nav.globalPrivacyControl === true, dnt: navigator.doNotTrack === "1" };
}

function secureAttr(): string {
  return location.protocol === "https:" ? "; Secure" : "";
}

export function writeConsent(analytics: boolean): void {
  document.cookie = `${CONSENT_COOKIE}=${formatConsent(analytics)}; path=/; max-age=${CONSENT_MAX_AGE_SECONDS}; SameSite=Lax${secureAttr()}`;
}

/** Deletes the analytics identifiers, so turning analytics off leaves nothing behind. */
export function revokeAnalytics(): void {
  for (const name of [VISITOR_COOKIE, SESSION_COOKIE]) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax${secureAttr()}`;
  }
}
