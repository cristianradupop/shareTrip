# Joiner dashboard and profile
Source: user request in this session

## Problem
The authenticated Joiner route is currently a placeholder, so joiners have no personal workspace for trips, requests, or account details. The user wants a complete Joiner area with clear menus and an editable profile.

## Behaviour
- Given an authenticated user opens `/joiner`, when the page loads, then they see a personalized dashboard with counts and links to trips, requests, and profile.
- Given an authenticated user opens any Joiner route, when navigating on desktop or mobile, then a responsive Joiner menu exposes Dashboard, My Trips, My Requests, My Profile, and Logout.
- Given an authenticated user opens My Trips, when they have approved memberships, then they see their joined trips with destination, dates, organizer, and trip status.
- Given an authenticated user opens My Requests, when they have requests, then they see each request with its pending, approved, or declined status and related trip details.
- Given a user has no trips or requests, when they open those pages, then they see helpful empty states and a path back to discover trips.
- Given an authenticated user opens My Profile, when the page renders, then they see their account details and can update first name, last name, phone, address, gender, and profile photo; username and email remain display-only.
- Given a profile update is invalid, an upload fails, or the API request is unauthorized, when submitted, then the user sees an explicit error and no unrelated account is changed.
- Given an unauthenticated visitor opens a Joiner route, when the page loads, then they are redirected to login.

## Out of scope
- Chat, saved trips, password/email/username changes, organizer workflows, and a site-wide avatar dropdown.
- New database tables or role changes.

## Constraints
- User decisions: Joiner-area navigation only; My Trips covers approved memberships and requests are also visible with status; profile edits include name, phone, address, gender, and photo, while email/username are read-only.
- Keep server-admin UI DB-free; use server-app REST endpoints and shared JSON-safe types.
- Every API handler must authorize with the session user, enforce same-origin on mutations, validate input, and audit account edits without recording sensitive field values.
- Existing `trip_members`, `trip_requests`, and profile columns are the source of truth; no schema migration is expected.
- Preserve the current gender-only JSON PATCH behavior for existing callers.
- Read the applicable Next.js 16 docs before writing Next-specific code; run targeted tests and `pnpm check`.
- ADRs: 0003 (CI/deploy), 0005 (server-app/server-admin architecture). Learnings: same-origin/auth checks for mutations; tests must mock `@/db/client`; new SQL needs a real-Postgres check before approval.

## Open questions
None. The user approved the scope choices in this session.
