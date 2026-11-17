# Plan: Split into server-app (backend) and server-admin (frontend)

Spec: [spec.md](spec.md) · Status: approved 2026-11-17

## Approach
The work ships as two PRs. **PR 1** (current branch `refactor/server-app-server-admin`) makes the repo a pnpm workspace and moves the app as it is into `server-admin/`. The root `package.json` keeps the same script names (`check`, `test`, `build`, `e2e`, `db:*`), so `ci.yml` does not change. `drizzle/` stays at the repo root in PR 1, so `migrate.yml` does not change either.
**PR 2** (new branch `refactor/server-app-rest` from an up-to-date `main` once PR 1 is merged, as CLAUDE.md requires) creates `server-app/`, which holds DB, auth, storage, data and REST route handlers, and turns `server-admin` into a fetch-only UI:
- Client components call `/api/*` through a `rewrites()` proxy to server-app.
- Server Components use a `server-only` `apiFetch` that forwards the request `cookie` header.
- Shared types and validators come from `server-app/shared` (zod only, relative imports).

## Options considered
- **Session lookup for Server Components.** Chosen: a custom `GET /api/session` that calls `auth.api.getSession({headers, query:{disableRefresh:true}})`. It is not rate limited, it keeps today's "no refresh during RSC" behaviour (nextCookies skips refresh in RSC; checked in `better-auth/dist/integrations/next-js.mjs`), and it returns only user fields. Rejected: calling Better Auth `/api/auth/get-session` directly, because it goes through DB rate limiting, which would hit the DB in e2e and put every SSR call into one bucket keyed by server-admin's IP.
- **Signup cookie.** Chosen: `POST /api/signup` keeps `auth.api.signUpEmail({body})`, and `nextCookies()` writes the cookie through `cookies().set`, which the Next route-handler docs allow. Rejected: `returnHeaders` plus copying set-cookie by hand, which means more code.
- **Migrations in PR 1.** Chosen: leave `drizzle/` at the root, with `server-admin/drizzle.config.ts` using `out: "../drizzle"`; it moves to `server-app/drizzle` in PR 2 with `git mv`. Rejected: moving it into `server-admin/drizzle` in PR 1, which would need two `migrate.yml` patches.

## Risks and assumptions
- **ADRs.** A new ADR 0005 supersedes 0001; 0001 is marked "superseded by 0005". 0002 still holds: two Vercel Hobby projects, both `fra1` (`vercel.json` in each package), $0. 0003 still holds: job names `check`/`migrations`/`e2e` stay, and migrations stay additive (PR 2 has none); 0005 records the new `server-app/drizzle/**` path. 0004 still holds: two PRs, squash merge by the human.
- **Learnings.** "Mock `@/db/client` in tests" applies: every server-app handler test mocks `@/db/client` and `@/lib/auth`, and the server-app vitest config sets the dummy `DATABASE_URL` and aliases `server-only` to an empty stub.
- **`.gitignore` is anchored** (`/node_modules`, `/.next/`, `/coverage`, `/out/`, `/build`), so package-level `node_modules` and `.next` would get committed. It must be unanchored in T1.
- **`shared` must not use `@/` imports.** server-admin type-checks those files with its own `@/*` → `server-admin/src` alias. They must only import `zod` and relative files. An ESLint `no-restricted-imports` rule in server-admin allows only `server-app/shared`.
- **Rewrites and `SERVER_APP_URL`.** Rewrites are compiled into the build, so server-admin needs `SERVER_APP_URL` at build time. It defaults to `http://localhost:3001`, and the build throws if `VERCEL_ENV` is set and the variable is missing. Whether `next start` re-reads rewrites is **unverified**, so e2e runs server-app on port 3001 to avoid depending on it.
- **`OrganizerTrip`** today includes a `Date` (`createdAt`). It becomes an explicit JSON-safe type in `shared` (`createdAt: string`), and the data layer maps to it.
- **Refresh after admin edits.** `revalidatePath` goes away. Admin mutations must call `router.refresh()` on success (`create-trip-dialog` already does).
- **Login, logout and cookies through the rewrite.** The Origin header is server-admin's origin, which equals `BETTER_AUTH_URL`, so it is trusted (checked in `origin-check.mjs`). Server-side GETs skip the origin check.
- **Cookie domain.** Set-Cookie without a Domain lands on server-admin's origin. Direct calls to the server-app domain carry no session cookie, and the Lax cookie protects against cross-site POSTs.
- **Unverified items:**
  - Vercel external rewrites forward the client IP. If they don't, Better Auth sign-in rate limits are shared; the fix would be `advanced.ipAddress`.
  - A Next 16 app with only route handlers (`app/route.ts`) builds without a root layout. If not, add a minimal layout.
  - Vercel "Include files outside Root Directory" is on (server-admin imports `../server-app/src/shared`).
  - "Promote to Production" is available on Hobby. Fallback: `vercel deploy --prod` from the PR 2 checkout.
- **Untouched by design:** `trip_members`, the `FeedTripCard` `action` slot, `nextCookies()` last, DB rate limiting, `prepare:false` + `max_pipeline:1`, the photo check in `databaseHooks.user.create.before`, and `user-service.ts` without `server-only`.
- **`next dev` writes `AGENTS.md`** into each package directory. Commit `server-admin/AGENTS.md` and `server-app/AGENTS.md`.

## Tasks
### PR 1: workspace, app moved unchanged (branch `refactor/server-app-server-admin`)
- [x] **T1 Workspace and move.**
  - Files: `git mv src public components.json next.config.ts eslint.config.mjs vitest.config.mts drizzle.config.ts vercel.json scripts → server-admin/`; new `server-admin/{package.json (name server-admin, all current deps), tsconfig.json}`; root `package.json`, `pnpm-workspace.yaml` (`packages: [server-admin]`), `vitest.config.mts`, `playwright.config.ts`, `tsconfig.json`, `.gitignore`, `pnpm-lock.yaml` (via `pnpm install`).
  - Change:
    - `server-admin/drizzle.config.ts`: `out: "../drizzle"`.
    - Root scripts: `dev`/`build`/`start`/`db:*` → `pnpm --filter server-admin <script>`; `lint`/`typecheck` → `pnpm -r <script>`, and `typecheck` also runs `tsc --noEmit` on the root `e2e` + configs.
    - Root `test` → `vitest run --reporter=dot`, with a root config `test.projects: ["server-admin"]` (the `projects` option exists in the installed vitest).
    - Playwright `webServer.command` → `pnpm --filter server-admin exec next start -p 3100`.
    - Root keeps `prepare`, `packageManager`, `engines` and devDeps `@playwright/test`, `vitest`, `typescript`, `@types/node`.
  - Tests: the existing 3 unit files and the 7×2 smoke tests, unchanged. `pnpm test:file server-admin/src/lib/user-service.test.ts`.
  - Done when: `pnpm check`, `pnpm build`, `pnpm e2e`, `pnpm db:check` pass from the root and `git status` shows no `.next`/`node_modules`.
- [x] **T2 PR 1 guardrail patches and docs.**
  - Files: `specs/server-app-server-admin/guardrail-patches/pr1-stop-check.patch` (pathspec becomes `server-admin e2e drizzle package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vitest.config.mts playwright.config.ts`, and the untracked list `server-admin e2e drizzle`); `pr1-security-reviewer.patch` (`src/` → `server-admin/src/`); `README.md` (paths, `.env.local` now in `server-admin/`); `CLAUDE.md` (paths, `pnpm --filter`); `docs/ghid-colega.md` (path `server-admin/src/app/(joiner)/`, `.env.local` location); `.github/copilot-instructions.md` (generated paths). `ci.yml`, `migrate.yml` and `deploy-smoke.yml` do not change.
  - Done when: `git apply --check specs/server-app-server-admin/guardrail-patches/pr1-*.patch` passes, `wc -l CLAUDE.md` is under 200, and `pnpm check` passes.

**PR 1 ENDS HERE.** The human:
1. Applies the PR 1 patches and moves `.env.local` to `server-admin/.env.local`.
2. Commits, including `specs/` and `docs/ghid-colega.md`, and opens PR 1.
3. Sets the Vercel `share-trip` Root Directory to `server-admin` with "Include files outside Root Directory" on.
4. Redeploys the PR 1 preview and checks `/`, `/login`, and the `/admin` redirect.
5. Merges once CI is green and watches `deploy-smoke`. Production keeps serving the previous deployment until the new build succeeds.

### PR 2: server-app plus REST (new branch from `main` after PR 1 merges)
- [ ] **T3 Scaffold server-app and move server code.**
  - Files: `server-app/{package.json (name server-app, exports {"./shared":"./src/shared/index.ts"}, scripts dev `next dev -p 3001`, start, build, lint, typecheck, test, db:*), next.config.ts, tsconfig.json, eslint.config.mjs, vitest.config.mts, vercel.json, drizzle.config.ts, .env.example}`; `git mv` into `server-app/`: `server-admin/src/{db,data,lib/auth.ts,lib/storage.ts,lib/user-service.ts,lib/validators.ts,lib/*.test.ts except format}`, `server-admin/scripts`, `drizzle/ → server-app/drizzle/`; new `server-app/src/shared/{index.ts,types.ts}` (re-exports validators; `FeedSort`, `FeedTrip`, `OrganizerTrip` with JSON dates, `OrganizerStats`, `AdminUserRow`, `SessionUser`, `ApiResult`); `server-app/src/app/route.ts` (GET / returns `{name:"server-app",status:"ok"}`); `server-app/src/app/api/health/route.ts`; `server-app/src/app/api/auth/[...all]/route.ts`.
  - Change: `data/*.ts` import the types from `@/shared/types`, and `getOrganizerTrips` maps `createdAt` to an ISO string. Update `pnpm-workspace.yaml` and the root `vitest` projects; root `db:*` → `--filter server-app`.
  - Tests: moved `validators`/`user-service` tests plus a new `server-app/src/test/health.test.ts`. `pnpm test:file server-app/src`.
  - Done when: `pnpm --filter server-app build` passes with dummy env and `pnpm db:check` passes.
- [ ] **T4 REST handlers and authorization.**
  - Files: `server-app/src/lib/api-auth.ts` (`getApiSession(req)`, `requireApiUser` → 401 Response, `requireApiAdmin` → 401/403); route handlers `api/session` GET; `api/signup` POST multipart (logic from `signUpAction`); `api/trips` POST (organizerId taken from the session); `api/organizer/trips` GET `?limit`; `api/organizer/stats` GET; `api/feed` GET `?city&sort&cursor`; `api/feed/since` GET `?since&city`; `api/feed/cities` GET; `api/admin/users` GET `?q&page` and POST; `api/admin/users/[id]` PATCH and DELETE (`RouteContext`); `api/admin/users/[id]/ban` POST. Error body `{ok:false,error}` with status 400/401/403/409. Same messages and self-protection rules as today's actions.
  - Tests in `server-app/src/test/api/*.test.ts`, mocking `@/db/client`, `@/lib/auth`, `server-only`:
    - Each protected endpoint returns 401 without a session.
    - Each admin endpoint returns 403 for a `role:"user"` session.
    - POST `/api/trips` with body `organizerId:"evil"` inserts the session user's id.
    - Signup with no photo, a file of 2 MB + 1 byte, or GIF bytes returns 400 with today's messages.
    - Admin deleting or banning themselves returns 400.
    - `/api/session` without a cookie returns `{user:null}`.
    - Command: `pnpm test:file server-app/src/test/api`.
  - Done when: all of these pass and `pnpm check` passes.
- [ ] **T5 server-admin talks to server-app only.**
  - Files: `server-admin/src/lib/{api.ts (server-only `apiFetch`: `cookies()` → cookie header, `cache:"no-store"`), session.ts (`getSession`: no Better Auth session cookie → null without fetching, else `/api/session`; `requireUser`/`requireAdmin` redirects unchanged; `assertAdmin` removed), client-api.ts (`fetch` JSON/FormData → `{ok,error}`)}`; `next.config.ts` (rewrite `/api/:path*` → `${SERVER_APP_URL}/api/:path*`, drop `serverActions`); the pages `feed`, `admin`, `organizer/{page,trips}` and the components `signup-form`, `create-trip-dialog`, `feed-client`, `users-table`, `user-form-dialog` (fetch plus `router.refresh()`), and the type imports in `feed-trip-card`/`organizer-trip-card` → `server-app/shared`; delete `app/actions`, `app/api`; drop DB/Supabase/Drizzle deps; add `"server-app":"workspace:*"`; ESLint `no-restricted-imports`; `server-admin/.env.example` (`SERVER_APP_URL` only).
  - Tests: `server-admin/src/lib/format.test.ts` still passes. `pnpm test:file server-admin/src`.
  - Done when: `grep -rE "db/client|drizzle|postgres|supabase|better-auth/(next-js|api)|\"use server\"" server-admin/src` is empty and `pnpm --filter server-admin build` passes.
- [ ] **T6 e2e with both apps.**
  - Files: `playwright.config.ts` (webServer array: server-app on 3001 with dummy env and `BETTER_AUTH_URL=http://localhost:3100`; server-admin on 3100 with `SERVER_APP_URL=http://localhost:3001`), `e2e/smoke.spec.ts` (+ test: `request.get("/api/health")` returns 200 JSON `status:"ok"`).
  - Done when: `pnpm build && pnpm e2e` gives 8×2 passing.
- [ ] **T7 PR 2 guardrail patches**, in `specs/server-app-server-admin/guardrail-patches/`:
  - `pr2-migrate.patch`: `paths: ["server-app/drizzle/**"]`.
  - `pr2-stop-check.patch`: add `server-app`, drop `drizzle`.
  - `pr2-deploy-smoke.patch`: if `$URL/` returns JSON with `"server-app"`, check `/` 200, `/api/session` 200 and `/api/admin/users` 401; otherwise run today's checks.
  - `pr2-codeowners.patch`: `/server-app/` and `/server-app/drizzle/` → owner.
  - `pr2-security-reviewer.patch`: paths `server-app/src/{app/api,lib,data}` and `server-admin/src/lib/api.ts`; invariant 1 becomes "handlers call `requireApiUser`/`requireApiAdmin`".
  - `ci.yml`: no patch expected (root scripts and the job-level dummy env cover both builds); add one only if T6 fails in CI.
  - Done when: `git apply --check` passes for each patch.
- [ ] **T8 Docs.**
  - Files: `server-app/README.md` (endpoint table: method, path, auth, body, response), `README.md` (two modules, two `.env.local` files, ports 3000/3001, zones tree), `CLAUDE.md` (Architecture/Commands for the two modules, invariants now under `server-app/`, under 200 lines), `docs/adr/0005-two-modules-server-app-server-admin.md` plus the 0001 status line, `docs/ghid-colega.md` (Joiner UI in `server-admin/src/app/(joiner)/`; endpoints and tables in `server-app/`), `.github/copilot-instructions.md`, `AGENTS.md` (docs path per package).
  - Done when: `wc -l CLAUDE.md` is under 200 and every route in `server-app/src/app/api` appears in the table.

## Verification
- **Each PR:** `pnpm install --frozen-lockfile && pnpm check && pnpm db:check && pnpm build && pnpm e2e`; `git apply --check specs/server-app-server-admin/guardrail-patches/<pr>-*.patch`.
- **Running app (PR 2):** `pnpm dev`, which runs both apps, then on http://localhost:3000 go through:
  1. Landing, logged out and logged in.
  2. Signup with a photo; signup with a >2 MB photo shows the error.
  3. Login as `alex`; `/organizer` shows stats and trips; create a trip and it appears.
  4. `/feed`: filter, load more, refresh.
  5. As admin: `/admin` create, edit, ban, unban, delete, with the list refreshing each time.
  6. Logout.
  7. A non-admin on `/admin` lands on `/?forbidden=admin`.
  8. `curl localhost:3001/` returns JSON; `curl localhost:3001/api/admin/users` returns 401.
- **Human Vercel cutover for PR 2, before merging:**
  1. Create the Vercel project `share-trip-server-app` from the same repo with Root Directory `server-app` and region fra1. Set Production and Preview env: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PHOTOS_BUCKET`, `BETTER_AUTH_SECRET` (same value), `BETTER_AUTH_URL=https://share-trip-inky.vercel.app`.
  2. Deploy the PR 2 branch and use "Promote to Production" (fallback: `vercel deploy --prod`). Check `https://<server-app>/` returns JSON, `/api/session` returns `{user:null}` and `/api/admin/users` returns 401.
  3. On `share-trip`, add `SERVER_APP_URL=https://<server-app-prod-domain>` for Production and Preview. Redeploy the PR 2 preview and check `/`, `/login`, `/api/health`, and the `/feed` redirect. Login on the preview may fail, which was accepted.
  4. Merge PR 2. Check production login, feed, organizer and admin, and that `deploy-smoke` is green for both projects.
  5. After about a day, remove the DB, Supabase and Better Auth secrets from `share-trip`. Instant Rollback still works because deployments snapshot their env.

## Open questions
- [nice] The production domain of the server-app Vercel project, for `SERVER_APP_URL` and the README. A placeholder is used until the human creates the project.
- [nice] The Joiner colleague's GitHub handle, to add their zone paths to CODEOWNERS (otherwise only the owner is listed).
- No blocking questions.

## Run notes
- PLAN: planner hit its 40-turn limit while reading Next/Better Auth internals and returned no report → resumed with "write the plan now, at most 3 more tool calls".
- REVIEW T1: root `lint` became `pnpm -r lint`, which skips the workspace root, so `e2e/` and root configs silently lost lint coverage (APPROVE with warning) → fix round 1 added a root `eslint.config.mjs` and `eslint e2e playwright.config.ts vitest.config.mts` to root `lint`, proven with a deliberate lint error.
