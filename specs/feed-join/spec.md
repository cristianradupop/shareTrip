# Join requests from the landing feed

Source: user request (chat, 2026-11-19): "si sa am si buton de join la fiecare excursie din feed, daca sunt logat ca joiner sa pot da join, daca nu, sa ma duca la pagina de log in ca joiner"; built on branch `feat/public-feed-home`, on top of the staged public feed ([../public-feed-home/spec.md](../public-feed-home/spec.md)).

## Problem
The public feed on `/` shows every upcoming trip, but nobody can join one. Each card needs a Join action: logged-in users send a request that the trip's organizer approves or declines; logged-out visitors are sent to log in and come back to the feed. Trips can be limited to men or women, so accounts need a gender.

## Behaviour
Joining (feed card, `FeedTripCard` `action` slot):
- Given a logged-out visitor, when they click Join on a card, then they go to `/login?next=/#trips`; after logging in (or signing up, which also honours `next`) they land back on the feed and click Join again (no automatic join).
- Given a logged-in user and a trip they can join, when they click Join, then a confirmation dialog shows the trip details with "Send request"; confirming creates a pending request and the card shows "Requested" with Withdraw. No message field.
- Given the viewer's state for a trip, when the card renders, then it shows exactly one of: Join, Requested (+ Withdraw), Joined (+ Leave), Declined (disabled), Full (disabled), or a disabled reason when their gender doesn't match. The feed returns the viewer's state only with a session.
- Given a pending request, when the user withdraws it, then it is deleted and the card returns to Join.
- Given an approved member, when they click Leave before departure, then their `trip_members` row is deleted and the card returns to Join.
- Given a declined request (by the organizer or automatically), when the card renders, then it shows Declined and the user cannot request that trip again.
- Given a trip where organizer + approved members ≥ max travelers, when the card renders, then Join is disabled as "Full" and the server refuses new requests. `trips.status` is never written by this feature.
- Given a trip for men only or women only, when a user whose gender doesn't match views it, then Join is disabled with the reason; the server refuses the request. Mixed trips accept everyone.
- Given an admin account, when it views the feed, then it can request to join like any user.

Organizer side:
- Given an organizer's trip card (`OrganizerTripCard`), when it renders, then it shows "Requests (n)" with the pending count; clicking opens a dialog listing pending requests (name, photo, age, gender; no email or phone) and approved members.
- Given a pending request, when the organizer approves it, then the server re-checks ownership, capacity and gender, inserts the user into `trip_members` and marks the request approved, in one transaction; if the trip is full or the gender no longer matches, approval is refused with a clear message.
- Given the approval that fills the last seat, when it completes, then every remaining pending request for that trip is declined automatically.
- Given a pending request, when the organizer declines it, then it is marked declined.
- Given the organizer nav, when it renders, then "My Trips" shows a badge with the total pending requests across the organizer's trips (computed per page load).
- The organizer cannot remove an approved member.

Gender on accounts:
- Given signup, when the form is submitted, then gender (male or female) is required, and enforced server-side like the profile photo (also for the public Better Auth sign-up endpoint).
- Given existing accounts without a gender, when the change ships, then each gets a random male/female value (one-time backfill, as the user asked).
- Given a logged-in user, when they open their profile, then they can change their gender; an admin can set or change it in the admin user dialog.

Security:
- Every new mutating handler: `checkSameOrigin` (403), `requireApiUser` before reading the body (401), `requireJson` where a body exists (415). The user id always comes from the session; the organizer-only handlers check trip ownership in the handler (RLS is bypassed).
- A user cannot request their own trip, a cancelled trip, or one that has departed; a duplicate request returns a clear error, not a 500.

## Out of scope
- Automatic join after login; messages in the request; notifications beyond the pending-count badges (no realtime, ADR 0002).
- Removing a member by the organizer; listing my requests on `/joiner` (stays a placeholder); changing the hero "Continue as Joiner" box.
- Changes to PR #16 (edit trip): approval re-checks capacity and gender instead.
- Writing `trips.status` ("full").

## Constraints
- `trip_members` keeps meaning "approved member" (CLAUDE.md: keep it stable for the Joiner developer): requests live in a new table; approving inserts into `trip_members`.
- ADR 0003: migrations are additive and backward compatible (deploy and migration start together): new table, nullable `user.gender` column, backfill in the same migration is fine.
- ADR 0005: authorization in every handler; `server-app/src/shared` stays DB-free; Better Auth `nextCookies()` stays last.
- `docs/learnings.md`: mock `@/db/client` in tests; `checkSameOrigin` on every mutating handler; the feed `since` watermark rule.
- The feed response gains a viewer-state field only with a session; `server-app/src/data/trips.test.ts` pins the `FeedTrip` key set, update it deliberately.
- Seed scripts (`pnpm db:seed-demo`, `db:seed-admin`, `createCredentialUser`) must set a gender.
- Add the new endpoints to `server-app/README.md`. The user tells the Joiner developer about the change themselves.

## Open questions
- None.
