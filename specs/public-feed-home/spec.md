# Public trip feed on the landing page

Source: user request (chat, 2026-11-19): move the community feed out of Organizer and Joiner onto the first page, centered under the Organizer/Joiner boxes, visible to everyone (logged in or not), no "Community" button, all trips one under another, scrollable to the end (even 1000), newest first, with a nice travel-themed design.

## Problem
The trip feed lives on its own route (`/feed`) behind login, reached through a "Community feed" link in the Organizer nav and a button on the Joiner page. Visitors who are not logged in see no trips at all, so the landing page doesn't show what the product offers. The feed should be the centre of the landing page, open to everyone, newest trips first, loading as the visitor scrolls.

## Behaviour
- Given any visitor (logged in or not), when they open `/`, then a light "trips" section sits directly below the hero with the Organizer and Joiner boxes, a centered column, with the trip cards one under another; there is no button to reveal it.
- Given the feed, when it renders, then it shows only trips with status `active` or `full` whose departure is today or later (as the current feed), ordered by publication time (`createdAt`) newest first, ties broken by `id`.
- Given the visitor scrolls to the bottom of the loaded cards, when more trips exist, then the next page (~20) loads automatically and is appended, with a visible loading state; this repeats until the last trip, after which an end-of-list message shows.
- Given 1000 matching trips, when the visitor keeps scrolling, then all 1000 eventually appear, with no duplicates and none skipped (keyset cursor on `createdAt, id`).
- Given a full trip, when its card renders, then it carries a "Full" label.
- Given the feed section, when it renders, then the About and Contact sections come after the list (reached after the last trip or via the existing menu links), and the menu links still bring those sections into view.
- Given the feed controls, when they render, then there is a city filter and a Refresh control, and no sort control; changing the city restarts the list newest first for that city; Refresh adds trips posted since the list loaded at the top.
- Given a trip card, when it renders, then it shows, without opening anything: a coloured gradient header with a transport icon, the destination city and country prominently, date chips, budget and currency, seats taken/total with a progress bar, gender, transport, the theme clamped to two lines, and the organizer's short name ("First L.") and profile photo; no external images are loaded.
- Given a visitor who is not logged in, when the feed loads, then the organizer's short name and photo are shown; no email or other personal data is ever returned.
- Given a logged-in user, when the feed, Refresh or the city list loads, then trips they organize are excluded; a logged-out visitor sees all matching trips.
- Given `GET /api/feed`, `GET /api/feed/since` and `GET /api/feed/cities`, when called without a session, then they return 200 with data (public); with a session, they exclude the caller's own trips.
- Given the Organizer zone, when it renders, then there is no "Community feed" nav item or any link to the feed.
- Given the Joiner page, when it renders, then the feed text and the "Open the community feed" button are gone (minimal change; the page belongs to the Joiner developer).
- Given a request to `/feed`, when it is served, then it returns 404; `/feed` is no longer in the proxy matcher, so a logged-out visitor is not redirected to login.
- Given `FeedTripCard`, when the redesign lands, then its `action` slot still exists with the same contract, so the Joiner developer can plug "Join" into the landing feed.
- Given the landing page at phone width, when it renders, then the feed column fits with no horizontal scroll and the cards stay readable.

## Out of scope
- The Join button itself (the Joiner developer plugs it into the `action` slot later; they must be told the feed moved to `/`).
- Trip photos or external destination images.
- A sort control, or ordering other than newest first.
- Showing past or cancelled trips.
- A redirect from `/feed`.

## Constraints
- ADR 0002: free tier only (Vercel Hobby, Supabase free); pages of ~20 trips, never all rows in one request.
- ADR 0005: server-app is public; each handler decides its own auth. The feed endpoints become public reads with an optional session (no `requireApiUser`), still GET-only, with validated query params (city, cursor, since). No secrets or emails in the response.
- CLAUDE.md shared-file rule: `FeedTripCard`'s `action` slot and `trip_members` stay stable; changes to `server-app/src/shared` stay small and DB-free.
- `docs/learnings.md`: mock `@/db/client` in tests; after a move to `pnpm -r`/`--filter`, check that every root check still runs.
- The landing page is a Server Component; the feed is a client island fed initial data by a server fetch (forwarding cookies, so the own-trips exclusion works on first render).
- Tests and docs that change by design: `server-app/src/test/api/authz.test.ts` (feed rows no longer 401), `e2e/smoke.spec.ts` (`/feed` no longer redirects to login), `README.md`, `CLAUDE.md`, `server-app/README.md`.
- Open PR #16 (`feat/edit-trip`) touches organizer components; keep Organizer nav changes minimal to limit merge conflicts.

## Open questions
- None.
