"use client";

import Link from "next/link";
import { useConsent } from "@/components/consent/consent-provider";
import { Logo } from "@/components/logo";

const WORDS = ["Explore", "Plan", "Travel together"];

// A dark rounded block under every page, with a slow red wordmark marquee.
export function SiteFooter() {
  const { openSettings } = useConsent();
  return (
    <footer className="mx-auto w-full max-w-[1920px] px-3 py-3 sm:px-4 sm:py-4">
      <div className="overflow-hidden rounded-[2rem] bg-ink text-ink-foreground">
        <div className="grid gap-8 px-7 pt-10 sm:grid-cols-2 sm:px-10 lg:grid-cols-[2fr_1fr_1fr]">
          <div>
            <Logo className="[&_span]:text-ink-foreground [&_span_span]:text-primary" />
            <p className="mt-3 max-w-xs text-sm text-ink-foreground/60">
              Find travel companions or lead your own adventure.
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-primary">Explore</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-foreground/70">
              <li>
                <Link href="/#trips" className="hover:text-ink-foreground">
                  Trips
                </Link>
              </li>
              <li>
                <Link href="/#about" className="hover:text-ink-foreground">
                  About
                </Link>
              </li>
              <li>
                <Link href="/#contact" className="hover:text-ink-foreground">
                  Contact
                </Link>
              </li>
            </ul>
          </div>
          <nav aria-label="Legal">
            <p className="text-sm font-medium text-primary">Legal</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-foreground/70">
              <li>
                <Link href="/privacy" className="hover:text-ink-foreground">
                  Privacy
                </Link>
              </li>
              <li>
                <button type="button" onClick={openSettings} className="hover:text-ink-foreground">
                  Cookie settings
                </button>
              </li>
            </ul>
          </nav>
        </div>

        <div aria-hidden className="mt-10 overflow-hidden pb-4 select-none">
          <div className="flex w-max animate-marquee">
            {[0, 1].map((copy) => (
              <div key={copy} className="flex shrink-0 items-center">
                {[...WORDS, ...WORDS].map((w, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-8 pr-8 text-6xl leading-[1.15] font-semibold tracking-tight whitespace-nowrap text-primary/25 sm:text-8xl"
                  >
                    {w}
                    <span className="text-primary/60">✱</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-7 py-5 text-xs text-ink-foreground/50 sm:px-10">
          <span>© {new Date().getFullYear()} TripTogether, a course project</span>
          <span>Photos: Unsplash</span>
        </div>
      </div>
    </footer>
  );
}
