# Signup rate limit and client IP behind the rewrite

Source: GitHub issue #14 "Rate limiting behind the server-admin rewrite: verify client IP, limit signup" (follow-up from the PR 2 security review, #13). The human asked to resolve it fully (2026-11-19).

## Problem
Better Auth keys its DB rate limiter on the client IP, and it was unverified what server-app sees behind server-admin's Vercel rewrite. Separately, `POST /api/signup` calls `auth.api.signUpEmail` directly, so it has no rate limit at all, and it uploads the profile photo to Supabase Storage before anything else could stop it: anyone can create accounts and fill storage in a loop.

Measured on the live deployment (2026-11-19): after a sign-in through https://share-trip-inky.vercel.app, the `rate_limit` key was `<the caller's real public IP>|/sign-in/email` (one IP, not a Vercel proxy hop). A sign-in sent with forged `X-Forwarded-For: 1.2.3.4` and `X-Real-IP: 1.2.3.4` was still keyed on the real IP: Vercel overwrites the header. Better Auth's DB rate limiting is active in production.

## Behaviour
- Given `server-app/src/lib/auth.ts`, when it configures Better Auth, then `advanced.ipAddress.ipAddressHeaders` is explicitly `["x-forwarded-for"]`, with a comment recording the measurement and the caveat that a multi-entry header (an extra proxy in front) would make Better Auth fall back to one shared bucket.
- Given a `POST /api/signup` that passes the same-origin check, when it arrives, then it is counted per client IP (resolved like Better Auth: `getIP` from `better-auth/api` with the same options) in the existing `rate_limit` table under the key `<ip>|/signup`, before the form is parsed or the photo is uploaded; every attempt counts, failed validations included.
- Given an IP that already made 10 counted attempts in the current 1-hour window, when it posts again, then the response is 429 with a `Retry-After` header (seconds until the window ends) and the JSON error "Too many sign-up attempts. Try again later."; no photo is uploaded and no account is created.
- Given the window has passed, when the IP posts again, then the counter restarts.
- Given two different IPs, when they sign up, then each has its own counter.
- Given the IP cannot be resolved (getIP returns null; should not happen on Vercel), when a signup arrives, then it uses one shared bucket `unknown|/signup` with the same limit.
- Given local development and tests, when getIP returns 127.0.0.1, then the same limit applies to that key (same code everywhere).
- Given Better Auth's public `POST /api/auth/sign-up/email`, when it is called, then it returns 404: it is removed from the allowlist in `server-app/src/lib/auth-paths.ts`, because nothing in the app calls it and it would bypass the new limit. The `databaseHooks.user.create.before` photo/gender checks stay as a second defence.
- Given the signup form in server-admin, when the server answers 429, then the form shows the server's error message (no UI change expected; verify).
- Given concurrent requests from one IP, when they race, then the counter is updated atomically (no lost increments that would let a burst through).

## Out of scope
- New tables or migrations; workers or scheduled cleanup (ADR 0002).
- Limits on other endpoints; CAPTCHA; email verification.
- Changing which header Vercel provides (`x-vercel-forwarded-for` was not measured through the rewrite).

## Constraints
- ADR 0002: DB-backed limiter (no in-memory state on serverless), free tier. ADR 0005: server-app checks everything itself.
- `docs/learnings.md`: mock `@/db/client` in tests; `checkSameOrigin` stays first in mutating handlers; don't assert exact `state.updates`/`state.inserts` counts from the helpers fake (the limiter needs its own mock or a module stub).
- `server-app/src/lib/auth.ts` is a shared file: small change; `nextCookies()` stays last.
- Update `server-app/README.md` (signup row: 429; auth row: sign-up path removed) and CLAUDE.md where it says the public Better Auth sign-up endpoint can be called directly.
- The PR closes #14 and its description records the measurement (IPs masked) and the chosen limits.

## Open questions
- None.
