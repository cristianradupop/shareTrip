"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setAnalyticsEnabled } from "@/lib/analytics";
import { browserSignals, consentView, readStoredConsent, revokeAnalytics, writeConsent } from "@/lib/consent";

type ConsentContextValue = { analytics: boolean; openSettings: () => void };

const ConsentContext = createContext<ConsentContextValue>({ analytics: false, openSettings: () => {} });

export function useConsent(): ConsentContextValue {
  return useContext(ConsentContext);
}

type State = { showBanner: boolean; analytics: boolean; signalRespected: boolean };

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  // null until mounted: the cookie and the browser signals only exist on the client.
  const [state, setState] = useState<State | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only state once after mount
    setState(consentView({ stored: readStoredConsent(), ...browserSignals() }));
  }, []);

  const choose = useCallback((analytics: boolean) => {
    writeConsent(analytics);
    if (!analytics) {
      setAnalyticsEnabled(false);
      revokeAnalytics();
    }
    setState(consentView({ stored: readStoredConsent(), ...browserSignals() }));
  }, []);

  const openSettings = useCallback(() => {
    setDraft(consentView({ stored: readStoredConsent(), ...browserSignals() }).analytics);
    setSettingsOpen(true);
  }, []);

  const value = useMemo(() => ({ analytics: state?.analytics ?? false, openSettings }), [state?.analytics, openSettings]);

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {state?.showBanner && (
        <div
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background p-4 text-sm text-foreground shadow-lg"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground">
              We would like to use anonymous analytics to see how the site is used. Nothing is collected unless you accept.{" "}
              <a href="/privacy" className="underline underline-offset-4">
                Privacy
              </a>
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" onClick={openSettings}>
                Settings
              </Button>
              <Button variant="default" onClick={() => choose(false)}>
                Reject
              </Button>
              <Button variant="default" onClick={() => choose(true)}>
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cookie settings</DialogTitle>
            <DialogDescription>Choose what we may store in your browser. You can change this at any time.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <label className="flex items-start gap-3">
              <input type="checkbox" role="switch" checked disabled aria-label="Necessary" className="mt-1 size-4" />
              <span>
                <span className="block font-medium">Necessary</span>
                <span className="block text-muted-foreground">
                  Sign-in session, your consent choice and theme. Always on.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                role="switch"
                checked={draft}
                onChange={(e) => setDraft(e.target.checked)}
                aria-label="Analytics"
                className="mt-1 size-4"
              />
              <span>
                <span className="block font-medium">Analytics</span>
                <span className="block text-muted-foreground">
                  Anonymous visitor and session ids, pages viewed, clicks and timings. Off by default.
                </span>
              </span>
            </label>
            {state?.signalRespected && (
              <p className="text-muted-foreground">
                Your browser sends a Global Privacy Control or Do Not Track signal, so analytics stays off unless you turn it on here.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                choose(draft);
                setSettingsOpen(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConsentContext.Provider>
  );
}
