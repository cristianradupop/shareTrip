# Edit a trip as its organizer

Source: user request (chat, 2026-11-19): "vreau ca din meniul: Your trips sa am pe fiecare excursie buton de Edit, sa pot edita toate datele de pe excursie" (e.g. the Mirissa, Sri Lanka trip posted as the admin user).

## Problem
An organizer can post a trip but cannot change it afterwards: there is no update endpoint and no Edit control. Typos or changed plans (dates, budget, capacity) can only be fixed in the database. The organizer needs an Edit button on each of their trips that opens the existing "Trip details" form pre-filled and saves the changes.

## Behaviour
- Given an organizer viewing their active trip whose departure is today or later, when the trip card renders (dashboard "Your trips" on `/organizer` and "My Trips" on `/organizer/trips`, same `OrganizerTripCard`), then it shows an Edit button.
- Given a trip whose departure date has passed, or whose status is `cancelled`, when its card renders, then no usable Edit button is shown.
- Given the organizer clicks Edit, when the dialog opens, then it is the "Trip details" form titled "Edit trip", pre-filled with every field of the trip (destination city and country, departure and return dates, max travelers, gender, budget, currency, transport, theme), with a "Save" button.
- Given the edit form, when nothing has changed or the form is invalid, then Save is disabled.
- Given the edit form with unsaved changes, when the organizer closes it, then it asks to discard the changes (not "cancel this trip"); with no changes it closes directly.
- Given valid changes, when the organizer saves, then the trip is updated, the dialog closes and the card shows the new data after `router.refresh()`.
- Given an edit request, when it is handled, then the same field rules as create apply, including departure date today or later and return date not before departure.
- Given N people have already joined (`trip_members`), when the organizer sets max travelers below N, then the server rejects it with a clear message stating N, and nothing is saved.
- Given people have already joined, when the organizer changes dates, gender, budget or destination, then the change is allowed.
- Given no session, when the update endpoint is called, then it returns 401.
- Given a session user who is not the trip's organizer (including an admin), when they call the update endpoint for that trip, then it returns 404 or 403 and the trip is unchanged.
- Given a trip id that does not exist or is malformed, when the update endpoint is called, then it returns 404 (or 400 for a malformed id) without touching data.
- Given a cancelled trip or one whose departure has passed, when the update endpoint is called, then it is rejected and the trip is unchanged.
- Given an update body containing `organizerId`, `status`, `id` or `createdAt`, when it is handled, then those values are ignored; the organizer stays the session user and status/createdAt are unchanged.
- Given a mutating request from a foreign `Origin` or a non-JSON body, when the update endpoint is called, then it returns 403 / 415 as other mutating handlers do.
- Given a trip was edited, when the feed loads, then it shows the new data in the trip's original position (ordering by `createdAt` unchanged).

## Out of scope
- Changing the trip status (active / full / cancelled) or cancelling a trip.
- Admins editing other people's trips; an admin edits only trips they organize.
- Notifying Joiners about changes; warnings or locked fields when people have joined.
- `updatedAt` column, showing edited trips on feed Refresh, conflict detection (last save wins).
- Trip photos (trips have none today).
- A separate edit page.

## Constraints
- ADR 0005: server-app is public; the handler checks the session itself (`requireApiUser`), and ownership ("is this my trip") is checked in the handler/query, because the DB connection bypasses Supabase RLS. The organizer id always comes from the session.
- Mutating handler order as in `POST /api/trips`: `checkSameOrigin` (403), `requireApiUser` before reading the body, `requireJson` (415), zod validation.
- `docs/learnings.md`: mock `@/db/client` in tests; every mutating handler needs `checkSameOrigin`.
- ADR 0003: no migration needed; if one were, it must be additive.
- `server-app/src/shared` stays DB-free (zod + relative imports only). Changes to shared files (`server-app/src/shared`, `server-admin/src/components/ui`) are kept small.
- Keep `trip_members` and the `FeedTripCard` `action` slot stable (Joiner developer).
- Add the new endpoint to the table in `server-app/README.md`.

## Open questions
- None.
