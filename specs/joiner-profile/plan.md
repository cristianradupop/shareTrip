# Plan: Joiner dashboard and profile
Spec: [spec.md](spec.md) · Status: approved 2026-11-26 (manual plan; planner agent unavailable)

## Approach
Reuse the existing Joiner route group and the Organizer shell's responsive navigation pattern without changing the global avatar menu. Add session-scoped read models and REST endpoints for a Joiner dashboard, memberships, and request history. Expand the existing profile PATCH compatibly to validate and audit basic-field changes and securely replace a profile photo. Build the dashboard, trip/request lists, and editable profile pages with explicit loading/error/empty states and the existing design system.

## Tasks

### [x] 1. Adding Joiner read APIs and tests
- Add data-layer queries scoped exclusively to the authenticated user for memberships and all request statuses, returning only the fields needed by the UI.
- Add `/api/joiner/overview` and `/api/joiner/trips` handlers (or a single equivalent read endpoint if existing patterns favor it), with `requireApiUser` before data access.
- Extend shared JSON-safe types for the API response.
- Add tests for empty and populated data, pending/approved/declined requests, and unauthenticated access; confirm another user's records cannot be requested by supplying an id.

### [x] 2. Building responsive Joiner navigation and pages
- Add a Joiner layout/shell with Dashboard, My Trips, My Requests, My Profile, and Logout; mirror Organizer desktop sidebar/mobile menu conventions.
- Replace the placeholder dashboard with personalized summary cards and helpful links.
- Add trip and request pages using the new APIs, existing trip-card conventions where appropriate, and useful empty states linking to public trip discovery.
- Add focused UI/component tests if existing test patterns support them; otherwise validate the real app at desktop and mobile sizes.

### [x] 3. Enabling safe basic profile edits
- Extend validation and `/api/profile` PATCH to support names, phone, address, gender, and optional photo upload while preserving the existing JSON gender-only contract.
- Keep email and username read-only; derive `name` from first/last name and write account audit events with changed field names only.
- Validate photo signature and size through the existing storage helper, keep the old photo if an update fails, and clean up replaced uploads after a successful database update.
- Add handler tests for valid/invalid profile updates, legacy gender-only PATCH, photo failure/cleanup behavior, audit payloads, and session ownership.
- Build the Joiner profile page and form with save state, success/error feedback, and refreshed session data.

## Verification
- Run focused tests for changed data, API, validation, and UI modules.
- Run `pnpm check`.
- Run the real app and verify the Joiner dashboard, navigation, trip/request states, and profile editing at desktop and mobile sizes.
- Review every changed server-app API/data/profile path for authorization and ownership.

## Risks
- The existing session middleware provides all profile values; mutation must update the database and audit event consistently so refreshed sessions show the new name/photo.
- Photo replacement spans storage and database operations; preserve the old photo if validation/upload/database update fails, and do not let cleanup failure falsely report an account update failure.
- Joiner data queries may expose organizer/user fields accidentally; project only fields needed for the signed-in joiner.
- Shared API types and the profile endpoint affect both app modules and the existing Organizer gender editor; preserve compatibility.

## Run notes
- PLAN gate-1: planner agent could not start (tool returned HTTP 400, unsupported model); user chose to continue with a manually prepared plan.
- IMPLEMENT tests-first: harness-tester could not start (tool returned HTTP 400, unsupported model); the fallback tester wrote the API tests before implementation.
- IMPLEMENT task 2: coder agent stopped because task 1's staged checkpoint left tracked changes; completed the UI on the existing feature branch and verified it in the local app.
- IMPLEMENT task 3: test-writing agent could not start because the monthly quota was exceeded; added the profile tests directly before changing production code.
- TEST task 3: transaction rejection mock leaked into the next photo test → restored spies after each test.
