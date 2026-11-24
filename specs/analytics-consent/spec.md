# First-party analytics with cookie consent and a privacy page

Source: user request (chat, 2026-11-24): "poti sa faci un sistem de monitorizare a utilizatorilor pentru site-ul nostru? care sa urmareasca comportamentul vizitatorilor, interactiunile cu platforma, statistici, timp de raspuns, unde se da click, dar sa faci si o informare pe site gdpr si sa ceri consimtamant pentru cookie-uri." Answers to the planner's 16 questions, same day.

## Problem
Nobody can see how visitors use TripTogether: which pages they open, what they click, which actions they complete, or how fast pages and API calls feel. The site also has no privacy notice and no cookie consent. We need our own analytics (no third-party service, free tier only) that collects nothing until the visitor consents, a GDPR privacy/cookie page, and an admin view of the results.

## Behaviour
Consent (English UI):
- Given a visitor with no stored choice and no GPC/DNT signal, when any page loads, then a banner shows "Accept" and "Reject" with equal prominence, plus "Settings" with two categories: Necessary (always on, not toggleable) and Analytics (optional, off by default).
- Given the visitor accepts, rejects, or saves settings, when they choose, then the choice is stored in a first-party consent cookie (necessary category) for 6 months, the banner closes, and it shows again only after expiry or when the consent version changes.
- Given the browser sends Global Privacy Control (`navigator.globalPrivacyControl`) or Do Not Track = 1, when no explicit choice is stored, then analytics is off and no banner shows; Cookie settings still opens and notes that the browser signal is respected.
- Given any page, when it renders, then a footer (root layout) shows "Privacy" (links to `/privacy`) and "Cookie settings" (reopens the settings dialog), so withdrawing consent is as easy as giving it.
- Given a visitor who accepted, when they switch Analytics off, then collection stops at once and the analytics cookies are deleted.

Collection (only when Analytics consent is granted; before consent or after refusal nothing is sent and no analytics cookie is set):
- An anonymous random visitor ID (first-party cookie, 6 months) and a session ID (ends after 30 minutes of inactivity). No user ID is stored; each event records only whether the visitor was signed in (yes/no).
- Events: page view (normalized path, referrer domain only, language, screen size, device type and browser family derived on the server), time on page (on leave), clicks on links/buttons/elements with `data-track` (element identifier: `data-track` value, else tag + href path or short visible label), named interactions on success (signup, login, trip created, trip edited, join request sent), API timing for every `clientFetch` (method, normalized path, status, duration), and Web Vitals (LCP, INP, CLS, TTFB, FCP).
- Paths drop query strings and fragments and replace ids with `:id`. Values typed into inputs are never captured.
- `/admin/*` pages are not tracked.
- The client batches events and sends them to a public same-origin endpoint in server-app (also on page hide).
- The ingest endpoint stores nothing unless the request carries a consent cookie granting analytics; it checks `checkSameOrigin` and `requireJson`, caps batch size, validates with zod, and rate-limits per IP in the DB.
- The IP address is never stored. The server stores only a hash of the IP with a random salt that changes every UTC day; the previous days' salts are deleted, so hashes can't be linked across days or reversed. Raw user agent is not stored.
- Raw events older than 30 days are deleted opportunistically, in small batches, during ingest (no cron).

Privacy page (`/privacy`, English, public):
- States the controller as "the TripTogether team, a course project" with contact `contact@triptogether.example` (the address on the landing page); what data the app processes (account, trips, join requests, photos, session cookie, analytics), purposes and legal bases (contract for the account, consent for analytics, legitimate interest in security for the session IP/user agent stored by Better Auth, the raw IP in rate-limit keys for the window length, and the audit log), retention (analytics 30 days), processors (Supabase, Vercel) and their region, the visitor's rights (access, rectification, erasure, restriction, portability, objection, withdrawing consent, complaint to ANSPDCP), and a cookie table (name, purpose, category, duration).

Admin analytics:
- Given an admin, when they open the new "Analytics" tab, then it shows, for a range selector (today / 7 days / 30 days): tiles (page views, sessions, unique visitors, signed-in share, average time on page), charts (visitors and page views per day), and tables: top pages, top clicked elements, interactions, API latency p50/p95 per endpoint, Web Vitals p75 against the good/poor thresholds, devices/browsers, top referrers.
- Given a non-admin or logged-out visitor, when they open the tab or its endpoint, then they are redirected (page) or get 401/403 (endpoint).

## Out of scope
- Click coordinates, heatmaps, session replay; server-side handler timing.
- Linking events to user accounts; per-user analytics; export.
- Romanian translation of the banner and page; a cookie consent log in the DB.
- Third-party analytics (Vercel Analytics, PostHog, Clarity).

## Constraints
- ADR 0002 (free tier: no workers or cron, DB rate limiting), ADR 0003 (additive, backward-compatible migration), ADR 0005 (server-app has no pages, every endpoint checks its own access, `server-app/src/shared` stays DB-free). The design choice is recorded as ADR 0006.
- `docs/learnings.md`: mock `@/db/client`; `checkSameOrigin` on every mutating handler; no exact `state.*` counts; rate-limit rows live in the DB.
- Shared files (root layout, `server-admin/src/components/ui`, `server-app/src/db/schema`, `server-app/src/shared`): keep the changes small. The joiner zone is tracked automatically through the root layout: tell the Joiner developer.
- Charts need a new dependency (allowed by the human); keep it to one library.
- `pnpm dev` and `db:*` hit the live DB: run `db:migrate` only once the SQL is final, with the human's OK.

## Open questions
- Region of the Supabase project, for the privacy page: resolved, Frankfurt (ADR 0002).
