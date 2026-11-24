"use client";

import Link from "next/link";
import { useConsent } from "@/components/consent/consent-provider";

// Dark in both themes so it sits fine under the dark landing and under light pages.
export function SiteFooter() {
  const { openSettings } = useConsent();
  return (
    <footer className="border-t border-white/10 bg-slate-950 px-5 py-6 text-sm text-slate-400">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <span>© TripTogether, a course project</span>
        <nav aria-label="Legal" className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <button type="button" onClick={openSettings} className="hover:text-white">
            Cookie settings
          </button>
        </nav>
      </div>
    </footer>
  );
}
