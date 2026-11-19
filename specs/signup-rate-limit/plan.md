# Plan: Signup rate limit and client IP behind the rewrite

Spec: [spec.md](spec.md) · Status: approved 2026-11-19

## Approach
Add a small limiter module `server-app/src/lib/signup-limit.ts`. It resolves the client IP with Better Auth's own `getIP` (imported from `better-auth/api`) and the same IP options that `auth.ts` now sets explicitly. It counts every attempt with a single atomic Drizzle upsert into the existing `rate_limit` table under the key `<ip>|/signup`. The route calls it right after `checkSameOrigin`, before `req.formData()`, and answers 429 with `Retry-After` when the limit is reached. `/sign-up/email` comes off the Better Auth allowlist, and the docs are updated.

## Options considered
- **Fixed window, chosen.** `last_request` holds the start of the window for `|/signup` keys. Every attempt adds 1, and the count resets once `now - windowStart >= 1h`. `Retry-After` matches the spec's "window ends", and an IP that keeps retrying can't push its own lockout forward. Main risk: a burst of 2x10 is possible across a window boundary, which is acceptable.
- **Sliding window like Better Auth** (`last_request` = time of the last request). Each blocked retry extends the lockout and "seconds until the window ends" becomes unclear. Rejected.
- **Transaction with SELECT ... FOR UPDATE, then UPDATE/INSERT.** The first insert still races on the unique key and it costs more round trips on the transaction pooler. Rejected in favour of one `INSERT ... ON CONFLICT (key) DO UPDATE ... RETURNING`.
- **IP options read from `auth.options` in the limiter.** The test mock of `@/lib/auth` (helpers `authModule`) has no `options`. Rejected: a shared constant module is used instead.

## Risks and assumptions
- **ADR 0002:** state lives in the DB, with no worker and no cleanup. Rows stay at one per IP, like Better Auth's own rows. No migration and no new table. **ADR 0005:** server-app checks this itself.
- **Better Auth and our keys share `rate_limit`.** Better Auth only reads keys for its own paths, so `|/signup` rows are never seen by it. A code comment records that `last_request` means "window start" for these rows.
- **Typing of the SQL values.** postgres.js runs with `prepare: false`. Cast the parameters inside `sql\`...\`` to `::bigint` so both CASE branches have the same type. Not verified against a live DB until T4.
- **DB errors.** If the upsert throws, the handler fails with a 500 before any upload. This is fail-closed, which is fine because sign-up needs the DB anyway.
- **Assumed, not compiled:** `getIP(req, { advanced: { ipAddress } })` type-checks against `BetterAuthOptions`, which looks all-optional. `getIP` returns `"127.0.0.1"` under vitest (NODE_ENV=test) when no header is sent. This is confirmed in `@better-auth/core@1.7.25` `dist/utils/ip.mjs`. A header with several entries returns `null`, so that request lands in `unknown|/signup`.
- **No UI change.** `server-admin/src/components/auth/signup-form.tsx` (lines 80-82) already shows `result.error`. `clientFetch` passes `body.error` through on any non-OK status.
- **Learnings:**
  - Mock `@/db/client`: the new tests use their own fake db.
  - `checkSameOrigin` stays first: the limiter runs after it, so a foreign Origin is not counted.
  - Don't assert counts on `state.inserts`/`state.updates`: the limiter tests use their own fake, and the route tests stub the module.
  - Not applicable: the `pnpm -r`, Vercel, feed-reducer and backfill rules.
- **Coupling:**
  - Both `hardening.test.ts` and `signup.test.ts` must stub `@/lib/signup-limit`. Otherwise the helpers fake returns a trip row with no `count`, which gives 429 and breaks "matching Origin works".
  - The 200 cases for `/sign-up/email` in `auth-paths.test.ts` and `auth-route.test.ts` flip to 404.
  - The CLAUDE.md line 37 wording changes.
  - `server-app/README.md` lines 39 and 41 change.

**Shared identifiers (exact names)** — all exported from `server-app/src/lib/signup-limit.ts` except `IP_ADDRESS_OPTIONS`:
- `IP_ADDRESS_OPTIONS = { ipAddressHeaders: ["x-forwarded-for"] }`, typed `{ ipAddressHeaders: string[] }`. It lives in `server-app/src/lib/client-ip.ts`, which also exports `clientIp(req: Request): string | null` = `getIP(req, { advanced: { ipAddress: IP_ADDRESS_OPTIONS } })`.
- Constants:
  - `SIGNUP_LIMIT_MAX = 10`
  - `SIGNUP_LIMIT_WINDOW_SECONDS = 3600`
  - `SIGNUP_LIMIT_PATH = "/signup"`
  - `SIGNUP_LIMIT_MESSAGE = "Too many sign-up attempts. Try again later."`
- Types:
  - `type SignupWindow = { count: number; windowStart: number }` (ms)
  - `type SignupVerdict = { allowed: true } | { allowed: false; retryAfterSeconds: number }`
- Functions:
  - `signupLimitKey(ip: string | null): string` returns `` `${ip ?? "unknown"}|/signup` ``.
  - `nextSignupWindow(previous: SignupWindow | null, now: number): SignupWindow` (pure). `null`, or `now - windowStart >= 3_600_000`, gives `{ count: 1, windowStart: now }`. Otherwise it gives `{ count: count + 1, windowStart }`. The SQL mirrors it, and the INSERT values come from `nextSignupWindow(null, now)`.
  - `signupVerdict(w: SignupWindow, now: number): SignupVerdict` (pure). Allowed when `count <= 10`. Otherwise `retryAfterSeconds = max(1, ceil((windowStart + 3_600_000 - now) / 1000))`.
  - `consumeSignupAttempt(req: Request, now = Date.now()): Promise<SignupVerdict>`. It does `db.insert(rateLimit).values({ id: crypto.randomUUID(), key, count: 1, lastRequest: now }).onConflictDoUpdate({ target: rateLimit.key, set: { count: CASE WHEN last_request <= now-window THEN 1 ELSE count+1 END, lastRequest: CASE ... THEN now ELSE last_request END } }).returning({ count, lastRequest })`, then calls `signupVerdict`.
- 429 body: `{ ok: false, error: SIGNUP_LIMIT_MESSAGE }`, with header `Retry-After: String(retryAfterSeconds)`.

## Tasks
- [x] **T1** Explicit IP config in a shared module.
  - files: `server-app/src/lib/client-ip.ts` (new), `server-app/src/lib/auth.ts` (add `advanced: { ipAddress: IP_ADDRESS_OPTIONS }` with a comment recording the 2026-11-19 measurement: Vercel overwrites XFF, single entry. Caveat: a multi-entry header falls back to one shared bucket. `nextCookies()` stays last), `server-app/src/test/api/auth-config.test.ts` (new, same pattern as `auth-photo-hook.test.ts`).
  - tests: `auth.options.advanced.ipAddress.ipAddressHeaders` equals `["x-forwarded-for"]`; `clientIp` returns `"1.2.3.4"` for `x-forwarded-for: 1.2.3.4` and `null`/`"127.0.0.1"` as `getIP` decides for a multi-entry value.
  - done when: those tests and typecheck pass.
- [x] **T2** Limiter module.
  - files: `server-app/src/lib/signup-limit.ts`, `server-app/src/lib/signup-limit.test.ts` (own `@/db/client` fake with `insert().values().onConflictDoUpdate().returning()` resolving to a set row, plus a `server-only` mock if imported).
  - tests:
    - `nextSignupWindow`: first, increment, reset exactly at 3600 s, no reset just before it.
    - `signupVerdict`: allowed at 10, blocked at 11, Retry-After rounds up, minimum 1.
    - `signupLimitKey(null) === "unknown|/signup"`.
    - `consumeSignupAttempt`: key `1.2.3.4|/signup` from XFF, two IPs give two keys, values `{count: 1, lastRequest: now}`, `target` is `rateLimit.key`, verdict follows the returned row.
  - done when: all green.
- [x] **T3** Wire the route and close the bypass.
  - files: `server-app/src/app/api/signup/route.ts` (limit right after `checkSameOrigin`), `server-app/src/lib/auth-paths.ts` (remove `/sign-up/email`), `server-app/src/lib/auth-paths.test.ts` and `server-app/src/test/api/auth-route.test.ts` (move it to the 404 cases), `server-app/src/test/api/signup.test.ts` and `hardening.test.ts` (partial `vi.mock("@/lib/signup-limit", importOriginal)` with `consumeSignupAttempt` as a `vi.fn` defaulting to `{ allowed: true }`).
  - tests:
    - A blocked verdict gives 429, the exact JSON, `Retry-After: "120"`, and no `formData` parsing, upload or `signUpEmail`.
    - Invalid data still calls `consumeSignupAttempt` once (failed validations count).
    - A foreign Origin gives 403 and the limiter is not called.
    - `POST /sign-up/email` returns 404 and never reaches Better Auth.
  - done when: `pnpm test` is green.
- [x] **T4** Docs.
  - files: `server-app/README.md` (signup row: 429 + Retry-After, 10 per IP per hour; auth row and the hardening paragraph: sign-up path removed), `CLAUDE.md` line 37 (the hook is now a second defence; the public endpoint is disabled).
  - done when: no mention says the public sign-up endpoint is callable.

## Verification
- `pnpm check`, then `pnpm build && pnpm e2e`.
- **Manually against the dev DB** (`pnpm dev`): send 11 `curl -F` signup posts with invalid data. The 11th returns 429 with Retry-After of about 3600. Check that `rate_limit` has the key `127.0.0.1|/signup` with count 11 (`pnpm db:studio`).
- **Reset:** set `last_request` back by more than one hour. The next post returns 400 (not 429) with count 1.
- **Concurrency:** a parallel burst of 15 (`seq 15 | xargs -P15 ...`) on a fresh key gives exactly 10 non-429 responses.
- **Bypass:** `curl -X POST :3001/api/auth/sign-up/email` returns 404.
- **UI:** the signup form shows "Too many sign-up attempts. Try again later." after the limit.

## Open questions
None.

## Run notes
- VERIFY: on `pnpm dev` (live DB), 15 parallel invalid signups gave exactly 10×400 and 5×429 (the atomic upsert holds); the next one got 429 with `Retry-After: 3600`; `/api/auth/sign-up/email` gave 404. The local key turned out to be `0000:…:0000|/signup` (Next's local rewrite sends an empty IPv6 address), not `127.0.0.1|/signup` as the plan assumed; that is local-only. The test row was deleted from the live `rate_limit` table afterwards.
