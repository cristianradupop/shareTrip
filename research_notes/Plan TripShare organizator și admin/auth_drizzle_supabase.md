# TripShare: Auth, Roles, Drizzle + Supabase Postgres Data Layer (Next.js 16), state as of 2026-11-13

Version numbers below were read from the npm registry on 2026-11-13 (registry.npmjs.org). Doc claims were read from official docs the same day. Sections marked "Inferences" are my own reasoning, not sourced facts; code in Inferences is proposed, not copied from docs.

## 1. Auth option comparison and recommendation (Better Auth vs Auth.js v5 vs Supabase Auth vs Clerk), roles, and admin app separation

### Takeaway
Recommend Better Auth (npm `better-auth` 1.7.23) with the Drizzle adapter plus the `admin` and `username` plugins. It is the only option that gives username login, a built-in admin/user role field, admin user-management APIs (create/list/set-role/ban/remove) and a Drizzle-native schema in one library. Runner-up: Supabase Auth, which is simplest if you want zero auth code but makes username login, roles and Drizzle integration more awkward. Auth.js v5 is still a beta and is now maintained by the Better Auth team; Clerk's free tier lacks custom password rules and user bans.

### Cited Findings
- Latest npm versions on 2026-11-13: better-auth 1.7.23 (a 1.8.0-beta.9 exists); next 16.4.6; next-auth `latest` tag is 4.24.15 and v5 is only on the `beta` tag (5.0.0-beta.32, published 2026-07-20); @clerk/nextjs 7.9.26 — [npm registry: better-auth](https://registry.npmjs.org/better-auth), [next](https://registry.npmjs.org/next), [next-auth](https://registry.npmjs.org/next-auth), [@clerk/nextjs](https://registry.npmjs.org/@clerk/nextjs)
- Auth.js docs: "The Auth.js project is now part of Better Auth"; the install instructions still say to install next-auth with the `beta` tag — [Auth.js migration page](https://authjs.dev/getting-started/migrating-to-v5)
- Better Auth blog: Auth.js (formerly NextAuth.js) is maintained by the Better Auth team and existing users can continue without disruption (September 2025; exact day differs across sources: 22 vs 26 Sept) — [Better Auth blog](https://better-auth.com/blog/authjs-joins-better-auth); [GitHub discussion #13252](https://github.com/nextauthjs/next-auth/discussions/13252)
- Better Auth joined Vercel; post by Bereket Engida dated July 7, 2026; the post says Vercel shares the commitment to open-source, framework-agnostic auth; it says nothing about license changes — [Better Auth joins Vercel](https://better-auth.com/blog/better-auth-joins-vercel)
- Better Auth install: `BETTER_AUTH_SECRET` (min 32 chars, `openssl rand -base64 32`) and `BETTER_AUTH_URL`; mount handler at `/api/auth/[...all]`; client via `createAuthClient` from `better-auth/react`; CLI `npx auth@latest generate` produces the ORM schema — [Installation](https://www.better-auth.com/docs/installation)
- Drizzle adapter now lives in a separate package: `npm install @better-auth/drizzle-adapter`, `import { drizzleAdapter } from "@better-auth/drizzle-adapter"`, `provider: "pg"`; a `/relations-v2` subpath exists for Drizzle Relations v2; `usePlural: true` option; workflow is `npx auth@latest generate` -> `npx drizzle-kit generate` -> `npx drizzle-kit migrate`. `npx auth migrate` is only for the built-in Kysely adapter, not Drizzle — [Drizzle adapter docs](https://www.better-auth.com/docs/adapters/drizzle); [Installation](https://www.better-auth.com/docs/installation)
- better-auth 1.7.23 peer deps: `drizzle-orm ^0.45.2 || >=1.0.0-rc.1 <2.0.0`, `drizzle-kit >=0.31.4 || >=1.0.0-beta.1`, `next ^14 || ^15 || ^16`, `react ^18 || ^19`; it depends on `zod ^4.5.4` — [npm registry: better-auth@1.7.23](https://registry.npmjs.org/better-auth/1.7.23)
- Admin plugin: adds `role`, `banned`, `banReason`, `banExpires` to user and one extra field to session; default roles `admin` and `user`; `defaultRole` default `user`; `adminRoles` default `["admin"]`; `adminUserIds` grants admin regardless of role; APIs: `admin.createUser`, `listUsers` (search, sort, limit default 100, offset; returns users/total/limit/offset), `setRole`, `banUser`/`unbanUser` (ban revokes sessions, banned users can't sign in), `removeUser` (hard delete). Server-side equivalents are `auth.api.*` and need session headers — [Admin plugin](https://www.better-auth.com/docs/plugins/admin)
- Admin plugin permission list: user: create, list, set-role, ban, impersonate, impersonate-admins, delete, set-password, set-email, set-phone, get, update; session: list, revoke, delete — [Admin plugin](https://www.better-auth.com/docs/plugins/admin)
- Username plugin: requires `emailAndPassword.enabled`; sign in with `authClient.signIn.username({username, password})`; server `auth.api.signInUsername`; defaults: min length 3, max 30, allowed chars alphanumeric/underscore/dot, lowercased normalization; `displayUsername` field can be disabled; `usernameValidator` can reject reserved names (example rejects "admin") — [Username plugin](https://www.better-auth.com/docs/plugins/username)
- Custom user fields: `user.additionalFields` with `type`, `required`, `defaultValue` (JS layer only; DB column stays optional), `input` (default true), `returned` (default true). Example uses `role` with `input: false` as server-owned — [Database concepts](https://www.better-auth.com/docs/concepts/database)
- Signup body default fields: `name`, `email`, `password`, `image`, `callbackURL`; additional fields/plugins allow extra properties — [Email & password](https://www.better-auth.com/docs/authentication/email-password)
- Password hashing: scrypt by default (memory-intensive, native to Node); custom `hash`/`verify` can be supplied; passwords default min 8, max 128 chars; `requireEmailVerification` is optional — [Email & password](https://www.better-auth.com/docs/authentication/email-password)
- Next.js 16 renames middleware to proxy: rename `middleware.ts` -> `proxy.ts` and export `proxy`; codemod `npx @next/codemod@canary middleware-to-proxy .`. Better Auth says `getSessionCookie` only checks cookie existence and "is not a security boundary"; full validation in proxy via `auth.api.getSession({ headers: await headers() })`; docs recommend validating the session in each protected page/route too. `nextCookies()` plugin is needed for server actions to set cookies and must be last in `plugins` — [Better Auth Next.js integration](https://www.better-auth.com/docs/integrations/next)
- Community sources report proxy runs on Node.js runtime (Edge not supported) and middleware.ts still works but is deprecated; this is from third-party posts, not read in official Next docs by me — [web search results incl. dev.to / johnkavanagh.co.uk](https://johnkavanagh.co.uk/articles/next-js-proxy-replaces-middleware/)
- Cookies: default prefix `better-auth` (cookie names `${prefix}.${name}`); `advanced.cookiePrefix` configurable; `advanced.crossSubDomainCookies {enabled, domain}` shares cookies across subdomains (add origins to `trustedOrigins`); docs warn to enable only when needed because untrusted subdomains could read cookies; secure cookies only in production by default — [Cookies](https://www.better-auth.com/docs/concepts/cookies)
- Rate limiting: on in production only by default (100 req / 10 s); `/sign-in/email` limited to 3 per 10 s; default storage is memory, which docs say is "not suitable for serverless"; `storage: "database"` (model `rateLimit`, needs migration) or secondary storage are options; `auth.api` server-side calls are not rate limited — [Rate limit](https://www.better-auth.com/docs/concepts/rate-limit)
- User deletion: `user.deleteUser.enabled: true`, with `beforeDelete`/`afterDelete` hooks; requires password or fresh session — [Users & accounts](https://www.better-auth.com/docs/concepts/users-accounts)
- Clerk Hobby plan: 50,000 monthly retained users; fixed 7-day session; not included: custom password requirements, user bans, MFA, passkeys, SMS; Admin/Member roles only within Organizations; custom roles need the $100/mo Enhanced B2B add-on — [Clerk pricing](https://clerk.com/pricing)
- Supabase free plan includes 50,000 MAU — [Supabase billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase)

### Inferences
- Why Better Auth wins here: one library covers username login (spec asks for username+password), `role` column, admin CRUD endpoints (matches "admin manages users"), and writes its tables through Drizzle so `user` lives in the same Postgres as trips with real foreign keys. Clerk/Supabase Auth store users outside your schema, so the "User entity + full CRUD" admin page would be built on a sync table.
- Auth.js v5 is not recommended: still beta on npm, project absorbed by Better Auth, and has no built-in username or admin plugin; it is more code for the same result.
- Supabase Auth (runner-up): fine for email login, but username login and a custom `role` need metadata/triggers on `auth.users`, and FKs to the `auth` schema from Drizzle are awkward. I did not fetch Supabase Auth docs, so this is based on general knowledge, not a cited source.
- Add one wrinkle to verify in a test: confirm a public signup request cannot set `role` (the admin plugin's own role field should be server-owned; check by sending `role: "admin"` in the signUp body and asserting it stays `user`).
- Roles: one `user` table, `role` in {user, admin}. Organizer/Joiner is NOT an auth role; it is per-trip (organizer_id on trip, rows in trip_members). Only admins are created by seed, never via public signup.
- Gating pattern (defence in depth): (1) `proxy.ts` in server-admin does the cheap `getSessionCookie` redirect only; (2) a `requireAdmin()` helper that calls `auth.api.getSession` and checks `session.user.role === "admin"` in EVERY server component, route handler and server action in server-admin; (3) never trust a client-side role check.
- Separate admin app: two Next.js projects (monorepo with shared `packages/db` and `packages/auth` config) pointing at the same Postgres. Cookies are host-scoped, so apps on different origins have separate sessions by default; for extra isolation give server-admin its own `advanced.cookiePrefix` and its own `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL`. Only enable `crossSubDomainCookies` if you want single sign-on, which you probably don't. Server-admin must reject any session whose role is not admin (a normal user logging into the admin URL should get 403, not a dashboard).
- Alternative that is even simpler for a student project: a `/admin` route group inside the one app; the spec says `server-admin`, so confirm with the instructor whether a separate deployable is required.
- Use `rateLimit: { storage: "database" }` (or enable only login rate limits) because memory storage does not hold across serverless instances.
- Seed first admin (my suggested approach, not from docs): script using `auth.api.signUpEmail` (or insert via Drizzle) then `db.update(user).set({ role: "admin" })`; or list the id in `adminUserIds`. `auth.api.createUser` needs an admin session, so it cannot create the very first admin.
- Better Auth now being a Vercel-owned project lowers abandonment risk, but the licence/roadmap effect is not stated in the post.

### Gaps
- No official Next.js docs page for proxy runtime (Node vs Edge) was read directly; only third-party posts.
- Did not verify the exact column list/type of the admin plugin's extra session field (`impersonatedBy` is my recollection only).
- Did not verify whether the admin plugin exposes a dedicated "update user profile fields" endpoint; only the `update` permission appears in the permission list. Profile edits in server-admin can be done via Drizzle directly behind `requireAdmin()`.
- No Supabase Auth documentation was fetched, so Supabase Auth + Drizzle claims are uncited.

## 2. Drizzle ORM version, drizzle-kit workflow, schema outline, indexes, seed

### Takeaway
Stable npm `latest` is drizzle-orm 0.45.4 / drizzle-kit 0.31.11; the 1.0 line is at release candidate 1.0.0-rc.5 (2026-10-21) and Drizzle's own Supabase guide now installs `@rc`. Pick stable 0.45.x unless you want Relational Queries v2; Better Auth 1.7.23 supports both. Workflow: `push` while prototyping alone, `generate` + `migrate` with committed SQL once two people share the schema.

### Cited Findings
- npm: drizzle-orm `latest` 0.45.4 (2026-10-08), `beta` 1.0.0-beta.22, `rc` 1.0.0-rc.5; drizzle-kit `latest` 0.31.11 (2026-09-21), `rc` 1.0.0-rc.5 — [drizzle-orm](https://registry.npmjs.org/drizzle-orm), [drizzle-kit](https://registry.npmjs.org/drizzle-kit)
- Drizzle releases page lists v1.0.0-rc.5 (Oct 21, 2026) as newest; only pre-releases shown, so 1.0 stable is not confirmed; breaking changes in rc.5 are mentioned but not listed; upgrade guides "v0 -> v1" and "Relational Queries v1 to v2" exist — [Drizzle latest releases](https://orm.drizzle.team/docs/latest-releases)
- Drizzle's Supabase quickstart installs `npm i drizzle-orm@rc postgres dotenv` and `npm i -D drizzle-kit@rc tsx`; config: `defineConfig({ out: './drizzle', schema: './src/db/schema.ts', dialect: 'postgresql', dbCredentials: { url: process.env.DATABASE_URL! } })` — [Drizzle + Supabase](https://orm.drizzle.team/docs/get-started/supabase-new)
- drizzle-kit: `generate` makes SQL migration files; `migrate` applies them; `push` syncs schema directly with no files; `check` detects migration collisions — [Drizzle Kit overview](https://orm.drizzle.team/docs/kit-overview)
- Index syntax: third argument of `pgTable` is a callback returning an ARRAY: `(table) => [index("name_idx").on(table.name), uniqueIndex("email_idx").on(table.email)]`; chainable `.on()`, `.using('btree', ...)` (accepts SQL expressions like `lower(col)` and `col.asc()`), `.concurrently()`, `.where(sql\`...\`)`, `.with({fillfactor})`; columns accept `.asc()` and `.nullsFirst()` — [Drizzle indexes & constraints](https://orm.drizzle.team/docs/indexes-constraints)
- Column types: `pgEnum('name', [...])` then `col: enumName()`; `uuid().defaultRandom()` = `gen_random_uuid()`; `timestamp({ withTimezone: true })` with `mode: "date"|"string"`; `date()`; `numeric({precision, scale})` with `mode: 'number'`; `integer()`; `boolean()`; `integer().primaryKey().generatedAlwaysAsIdentity()` — [Drizzle PG column types](https://orm.drizzle.team/docs/column-types/pg)
- Relational Queries v2: `defineRelations(schema, r => ({...}))`, `drizzle(url, { relations })`, `db.query.users.findMany({ where: { id: { gt: 10 } }, orderBy: { id: "asc" }, limit: 5, with: {...} })` — [RQB v2](https://orm.drizzle.team/docs/rqb-v2)

### Inferences
- Version choice: stable 0.45.4 is the conservative pick for a graded project. Drizzle's docs steering new projects to `@rc` suggests 1.0 is near-final, but the rc.5 notes mention unspecified breaking changes. Whatever you pick, pin exact versions in `package.json` and make both developers install the same one. Note the Better Auth Drizzle adapter has a separate `/relations-v2` entry for the 1.0 relations API.
- Workflow for two developers: (1) `npx auth@latest generate` once to create the Better Auth tables into `src/db/auth-schema.ts`; (2) all other tables in `src/db/schema.ts`; (3) `drizzle-kit generate` -> commit SQL -> `drizzle-kit migrate` for the shared Supabase DB. Use `push` only against a throwaway local DB. Run `drizzle-kit check` in PRs. Re-run the Better Auth `generate` whenever plugins/additionalFields change.
- Keep Better Auth's default text IDs for `user.id` and make FKs `text` (lowest risk). The `advanced.database.generateId: "uuid"` option exists but I did not verify how the CLI schema output reflects it.

Proposed schema outline (Drizzle, array-form index callbacks; verify exact imports against installed version):

```ts
// src/db/schema.ts  (auth tables come from `npx auth@latest generate` into auth-schema.ts)
import { pgTable, pgEnum, uuid, text, boolean, integer, date, numeric, timestamp, primaryKey, index, uniqueIndex, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth-schema";

export const genderEnum = pgEnum("trip_gender", ["male", "female", "mixed"]);
export const transportEnum = pgEnum("transport_method", ["plane","train","bus","car","ship","other"]);
export const tripStatusEnum = pgEnum("trip_status", ["open","full","cancelled","completed"]);

// user table extras via Better Auth additionalFields: firstName, lastName, phone, address, birthDate (date), plus role/username from plugins.
export const userPhotos = pgTable("user_photos", {
  id: uuid().defaultRandom().primaryKey(),
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  url: text().notNull(),           // public URL or storage path
  isPrimary: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("user_photos_user_idx").on(t.userId)]);

export const trips = pgTable("trips", {
  id: uuid().defaultRandom().primaryKey(),
  organizerId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  destinationCity: text().notNull(),
  destinationCountry: text().notNull(),
  departureDate: date({ mode: "string" }).notNull(),
  returnDate: date({ mode: "string" }),           // period; null = single day
  maxTravelers: integer().notNull(),
  gender: genderEnum().notNull(),
  budgetEstimate: numeric({ precision: 10, scale: 2, mode: "number" }).notNull(),
  currency: text().notNull().default("EUR"),
  transport: transportEnum().notNull(),
  theme: text().notNull(),                         // description
  status: tripStatusEnum().notNull().default("open"),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("trips_departure_idx").on(t.departureDate, t.id),
  index("trips_city_departure_idx").using("btree", sql`lower(${t.destinationCity})`, t.departureDate, t.id),
  index("trips_created_idx").on(t.createdAt),
  index("trips_organizer_idx").on(t.organizerId),
]);

export const tripMembers = pgTable("trip_members", {
  tripId: uuid().notNull().references(() => trips.id, { onDelete: "cascade" }),
  userId: text().notNull().references(() => user.id, { onDelete: "cascade" }),
  joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.tripId, t.userId] }), index("trip_members_user_idx").on(t.userId)]);

// Joiner phase (outline only; nothing above blocks it):
export const chats = pgTable("chats", {
  id: uuid().defaultRandom().primaryKey(),
  tripId: uuid().notNull().unique().references(() => trips.id, { onDelete: "cascade" }), // 1 group chat per trip
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
export const messages = pgTable("messages", {
  id: uuid().defaultRandom().primaryKey(),
  chatId: uuid().notNull().references(() => chats.id, { onDelete: "cascade" }),
  senderId: text().notNull().references(() => user.id),
  body: text().notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("messages_chat_created_idx").on(t.chatId, t.createdAt)]);
```

- Chat membership can be derived from `trip_members` (no separate chat_members table needed); joining = insert into `trip_members` + create `chats` row on first join (or at trip creation) inside one transaction. Enforce capacity in that transaction (count members, compare to `max_travelers`), e.g. with `SELECT ... FOR UPDATE` on the trip row.
- Postgres date/period: `departure_date` + nullable `return_date`; add a CHECK `return_date >= departure_date` via SQL if desired (Drizzle `check()` exists in pg-core from my memory; not verified here).
- Seed script (`scripts/seed-admin.ts`, run with `tsx`): load env, create the db client, call `auth.api.signUpEmail({ body: { name, email, password, username, ... } })`, then `db.update(user).set({ role: "admin", emailVerified: true }).where(eq(user.email, ADMIN_EMAIL))`; make it idempotent (skip if the email exists); read the password from an env var, never hard-code it. Optionally also seed ~20 fake trips for demoing the feed and timing the refresh.

### Gaps
- Exact drizzle-orm 1.0 breaking changes (migration folder layout, snapshots) were not found in the pages I fetched; the docs link to upgrade guides I did not read.
- `.desc()` ordering inside `index().on()` is not shown on the indexes page I fetched; a plain ascending btree index also serves descending scans, so it is not blocking.
- Drizzle `check()` constraint and `.enableRLS()` were not verified in docs.

## 3. Connecting Drizzle to Supabase Postgres from Vercel, local dev, free-tier limits

### Takeaway
Use `drizzle-orm/postgres-js` (the library Drizzle's Supabase guide uses) with the Supabase shared-pooler TRANSACTION string (port 6543) and `prepare: false` for the running app; use the direct or session-pooler string (port 5432) for `drizzle-kit migrate`. For local dev, a free hosted Supabase dev project is simplest; Supabase CLI (`supabase start`) needs Docker. Free tier pauses after about 7 days of low activity.

### Cited Findings
- Supabase connection modes: direct (5432, `db.[ref].supabase.co`, IPv6 only unless IPv4 add-on) for persistent backends and migrations; shared pooler session mode (5432, IPv4 on all plans); shared pooler transaction mode (6543) for serverless/edge — [Supabase: connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- Transaction mode does not support prepared statements: "Postgres.js and Drizzle use `prepare: false`"; session state (`SET`, advisory locks, `LISTEN/NOTIFY`, temp tables) does not persist; for serverless create the client once at module scope, pool size 1, prepared statements off, SSL `require`. Pooler username format `postgres.[PROJECT-REF]`; percent-encode special characters in the password — [Supabase: connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- Drizzle Supabase guide shows `postgres(process.env.DATABASE_URL, { prepare: false })` + `drizzle({ client })` for Transaction pool mode — [Drizzle + Supabase](https://orm.drizzle.team/docs/get-started/supabase-new)
- npm: postgres (postgres.js) latest 4.1.1; pg latest 8.23.1 — [postgres](https://registry.npmjs.org/postgres), [pg](https://registry.npmjs.org/pg)
- Free plan: 2 free projects (paused ones don't count), 500 MB database per project, 1 GB storage, 5 GB egress, 50,000 MAU, 2M realtime messages, 200 realtime peak connections — [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
- Pausing: Free projects with low activity over a 7-day period are paused; a few DB requests per day typically suffice; restore is possible for up to 1 year after pausing (official docs page); paid projects are never paused — [Supabase: project pausing](https://supabase.com/docs/guides/platform/free-project-pausing). Conflict: a search summary of other Supabase pages and a Reddit-quoted staff reply cite 90 days — [search results](https://supabase.com/kb/faqs/platform/free-project-pausing)
- Supabase CLI local dev: needs a Docker-compatible container runtime (OrbStack recommended on macOS, Docker Desktop on Windows/Linux); `init` once, `start` launches Postgres/Auth/Storage locally; Studio at http://localhost:54323 — [Supabase local development](https://supabase.com/docs/guides/local-development)
- Vercel Functions: default region `iad1`, changeable; Hobby default and max duration 300 s with Fluid compute; request/response body limit 4.5 MB; 1,024 file descriptors shared — [Vercel Functions limits](https://vercel.com/docs/functions/limitations)

### Inferences
- Env vars: `DATABASE_URL` = transaction pooler (6543) for the app on Vercel; `DIRECT_URL` or session-pooler URL (5432) used only by `drizzle.config.ts` for migrations. Many home networks are IPv4-only, so the direct host may not resolve; the session pooler (5432, IPv4) is the safe migration path. Neither string should be prefixed `NEXT_PUBLIC_`.
- Client module (server-only file, e.g. `src/db/index.ts`): `import "server-only"; const client = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, ssl: "require" }); export const db = drizzle({ client, schema });` Cache the client on `globalThis` in dev to avoid reconnect storms on hot reload.
- Latency: put the Supabase project in a region near the Vercel function region (default iad1; set Vercel's region to match the DB if your users/DB are in EU). This directly affects the "refresh in <3 s" requirement.
- Local dev options ranked for two students: (a) one shared hosted Supabase "dev" project, or one each; zero setup, but it is the same free pool (2 projects) and prod/dev must be separate projects; (b) Supabase CLI local stack (Docker) when offline work matters; (c) plain Docker Postgres or local Postgres is simplest of all because the app uses Drizzle and Better Auth, not Supabase Auth/Realtime, so no Supabase-specific services are required until chat realtime. The docs I read do not state the local DB port/credentials; check `supabase status` output.
- Pause risk: the project will pause during exam gaps. Mitigate with a scheduled ping (GitHub Actions or Vercel cron hitting a cheap DB-backed route at least every few days) and unpause before demo day; do not store irreplaceable data only in free tier without a `pg_dump`.

### Gaps
- Supabase free-tier direct connection and pooler client limits (max connections) were not found in the pages fetched.
- The restore window after pausing is inconsistent between sources (1 year per the official pausing doc I fetched vs 90 days elsewhere).
- Default local DB connection string for `supabase start` not confirmed from docs.
- Vercel Hobby's non-commercial-use restriction was not verified.

## 4. Photo upload: Supabase Storage vs Vercel Blob

### Takeaway
Use Supabase Storage with a public bucket (restricted to image/jpeg, image/png, size-capped) if the DB is already on Supabase: one fewer vendor and free 1 GB; store the object path or public URL in a `user_photos` table. Vercel Blob (public store, `@vercel/blob` 2.9.0) is an equally valid runner-up; both are free to 1 GB. Validate type and size on the server regardless of client checks.

### Cited Findings
- Supabase Storage: `supabase.storage.from('bucket').upload(path, file, { upsert, contentType })`; signed upload URLs via `createSignedUploadUrl` + `uploadToSignedUrl` (client can upload directly with a short-lived token); standard upload recommended up to ~6 MB, TUS resumable above; individual signed URLs cannot be revoked (rotate the signing key) — [Supabase standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads)
- Free plan global file size limit cannot exceed 50 MB; per-bucket max size and allowed file types can be restricted and must be below the global limit — [Supabase storage file limits](https://supabase.com/docs/guides/storage/uploads/file-limits)
- Free plan storage 1 GB, egress 5 GB — [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
- Vercel Blob: stores are private or public, chosen at creation and cannot be changed later; public = anyone with the URL, private = authenticated, delivered through your Function; `put(name, file, { access: 'public', addRandomSuffix: true })`; default overwrite protection (`allowOverwrite`); on Vercel the SDK uses OIDC automatically, a `BLOB_READ_WRITE_TOKEN` is needed for client uploads or non-Vercel hosts — [Vercel Blob docs](https://vercel.com/docs/vercel-blob)
- Vercel Blob Hobby: 1 GB storage, first 10,000 simple ops, first 2,000 advanced ops, 10 GB data transfer; exceeding limits blocks access for 30 days (no overage charge); rate limits 20 simple/s, 15 advanced/s — [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)
- Next.js Server Actions body limit defaults to 1 MB; raise with `experimental.serverActions.bodySizeLimit` (e.g. `'3mb'`); the limit includes multipart overhead (add ~10-20 KB). Server Actions compare Origin vs host for CSRF — [Next.js serverActions config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- Vercel Function request body limit is 4.5 MB (413 FUNCTION_PAYLOAD_TOO_LARGE) — [Vercel Functions limits](https://vercel.com/docs/functions/limitations)

### Inferences
- Because a server action default is 1 MB and Vercel's hard cap is 4.5 MB, either (a) cap photos at ~2 MB, set `bodySizeLimit: '3mb'`, and upload through the server action (simplest, lets you validate bytes server-side), or (b) use signed upload URL / Blob client uploads so large files bypass your function. For a student app (a) is enough.
- Validation checklist: client check (MIME `image/jpeg|png`, size) for UX; server re-check of size and of magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`), never trust `file.type`; generate the object name yourself (`<userId>/<uuid>.jpg`); do not reuse the user-supplied filename. Reject SVG.
- Public bucket is fine for profile photos shown in the feed/chat; use a private bucket + short signed read URLs only if photos must not be world-readable. For the "at least one photo" rule the signup flow must upload then write the `user_photos` row; if the DB insert fails, delete the uploaded object (otherwise orphans).
- Sequence for signup: validate -> create user via `auth.api.signUpEmail` -> upload photo (needs user id for the path) -> insert `user_photos`. Alternatively upload first under a temp path. Pick one and handle rollback.
- Supabase upload from the server needs the Supabase secret/service key (server env only) or storage RLS policies; with Vercel Blob you need no extra keys on Vercel. This is the one point where Vercel Blob is simpler.
- Cost/risk: Vercel Blob Hobby has a hard 30-day lockout when limits are hit and counts dashboard browsing as operations; Supabase's 1 GB is enough for thousands of compressed profile photos.

### Gaps
- Did not find a Supabase page confirming `getPublicUrl` or the exact bucket field names (`file_size_limit`, `allowed_mime_types`) — the Creating Buckets page was not fetched.
- Vercel Blob server-upload docs (`/docs/vercel-blob/server-upload`) and the client-upload page were not fetched.

## 5. Validation: Zod + React Hook Form + shadcn/ui (disabled-until-valid, red highlight, success message)

### Takeaway
Use Zod 4 schema shared by client form and server action, `useForm({ resolver: zodResolver(schema), mode: "onChange" })`, `disabled={!form.formState.isValid || isSubmitting}` on the button, and shadcn's current `Field` + `Controller` pattern with `data-invalid`/`aria-invalid` for red styling. Re-validate with the same schema in the server action.

### Cited Findings
- shadcn/ui docs now show forms with `<Field />`, `<FieldLabel>`, `<FieldError>`, `<FieldGroup>` plus React Hook Form `<Controller />` and `zodResolver`: set `data-invalid={fieldState.invalid}` on `<Field>` and `aria-invalid` on the control, render `<FieldError errors={[fieldState.error]} />`. The docs' default validation mode is `"onSubmit"`; other modes are `"onBlur"`, `"onChange"`, `"onTouched"`. The page does not cover disabled-submit — [shadcn/ui React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form)
- npm: zod 4.6.7; react-hook-form 7.92.0 (8.0.0-beta exists); @hookform/resolvers 7.0.6; shadcn CLI 4.23.0; tailwindcss 4.3.5 — [zod](https://registry.npmjs.org/zod), [react-hook-form](https://registry.npmjs.org/react-hook-form), [@hookform/resolvers](https://registry.npmjs.org/@hookform/resolvers), [shadcn](https://registry.npmjs.org/shadcn), [tailwindcss](https://registry.npmjs.org/tailwindcss)
- Better Auth itself depends on zod ^4.5.4 — [npm registry: better-auth@1.7.23](https://registry.npmjs.org/better-auth/1.7.23)

### Inferences
- Behaviour mapping: "button disabled until all valid" = `mode: "onChange"` + `formState.isValid` (RHF computes `isValid` on change when mode is not onSubmit; read it via the formState proxy). "Invalid fields highlighted red" = `fieldState.invalid` -> `data-invalid` + `aria-invalid`; shadcn's Input has `aria-invalid:border-destructive`-style styling in recent versions (verify in the generated `input.tsx`). If the spec wants fields red immediately even before touching them, call `form.trigger()` on mount or on first submit attempt; by default RHF only shows errors after a field is changed/blurred.
- Zod rules to include: username (3-30, `[a-zA-Z0-9_.]`, matches the plugin's defaults), password (min 8 to match Better Auth's min; recommend 10-12 and require mixed chars; max 128), email, first/last name, phone (regex or `libphonenumber-js` if you want strictness), address (min length), birthDate (`z.coerce.date()` or ISO string, must be in the past, optionally >= 18), photo: `z.instanceof(File).refine(f => ["image/jpeg","image/png"].includes(f.type)).refine(f => f.size <= 2*1024*1024)`; add `confirmPassword` with `.refine`. Put the schema in a shared file (no "use client") and use it in the server action with `safeParse`.
- File input wiring: `Controller` + `<Input type="file" accept="image/jpeg,image/png" onChange={e => field.onChange(e.target.files?.[0])} />`; send via `FormData` to a server action (mind the 1 MB default body limit).
- Success message: on a successful action show exactly "Your account has been successfully created" (inline `Alert` or `sonner` toast) and then redirect or switch to login; show server errors such as "username already taken" via `form.setError("username", ...)`.
- Compatibility of @hookform/resolvers 7.0.6 with zod 4.6 was not independently verified; run a quick smoke test after install (older resolvers needed `zod/v4` support and a specific major).
- Alternative if you want less boilerplate: React 19 `useActionState` with server actions and the same Zod schema; but RHF gives the live "disabled until valid" behaviour with less code.

### Gaps
- No source for the `isValid`/mode semantics was fetched (RHF docs not opened); the behaviour described is from general knowledge of RHF 7.
- shadcn's current Input invalid-state classes were not checked.

## 6. Security basics (RLS vs server-only DB access, secrets, passwords, GDPR)

### Takeaway
Because all DB access goes through server-side Drizzle with a server-only connection string, keep Supabase's Data API (anon/publishable key) locked: enable RLS on every table in an exposed schema with no permissive policies. Never expose `DATABASE_URL` or any Supabase secret key to the browser. Treat phone/address/birth date as personal data under GDPR: collect minimally, document purpose, support deletion/export.

### Cited Findings
- Supabase RLS docs: "Enable RLS on every table in an exposed schema"; a table in an exposed schema without RLS is readable and writable by any role with a grant on it; with RLS on and no policies, nothing is accessible through the API with a publishable key; new `public` tables may start with grants to `anon`/`authenticated`/`service_role` ("not every project grants these automatically"); a secret key maps to `service_role` which has `bypassrls` and must never be used in the browser; the `postgres` role has `bypassrls` — [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Next.js Server Actions compare the Origin header with the app host (CSRF protection); `allowedOrigins` lists extra hosts — [Next.js serverActions config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)
- Better Auth: scrypt hashing by default, 8-128 char passwords, `BETTER_AUTH_SECRET` >= 32 chars, `BETTER_AUTH_SECRETS` for secret rotation, rate limiting on `/sign-in/email` (3 per 10 s) in production, user deletion via `deleteUser.enabled` — [Email & password](https://www.better-auth.com/docs/authentication/email-password); [Installation](https://www.better-auth.com/docs/installation); [Rate limit](https://www.better-auth.com/docs/concepts/rate-limit); [Users & accounts](https://www.better-auth.com/docs/concepts/users-accounts)
- Better Auth warns the proxy/cookie check is "not a security boundary" and recommends per-route session validation — [Better Auth Next.js integration](https://www.better-auth.com/docs/integrations/next)
- Vercel Blob public stores are readable by anyone with the URL; private stores need authentication — [Vercel Blob docs](https://vercel.com/docs/vercel-blob)

### Inferences
- Because Drizzle connects as the `postgres` role (or a pooler user mapped to it), it bypasses RLS; that is expected for a server-only design, so authorization MUST be enforced in your code (check `session.user.id` in every query for owner-only data, e.g. only the organizer can edit/cancel a trip). Cleaner variant: create a dedicated Postgres role for the app instead of `postgres`; optional for this project.
- Concretely: run `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for every table (including Better Auth's `user`, `session`, `account`, `verification`, which hold password hashes and tokens) so that the public REST endpoint can never serve them. Do not create `anon` policies. This is the single most important Supabase-specific step; with no `NEXT_PUBLIC_SUPABASE_*` usage at all you could also disable the Data API in the project settings (not verified in docs).
- Secrets hygiene: `.env.local` in `.gitignore`; Vercel env vars per environment; no `NEXT_PUBLIC_` prefix on DB or Supabase secret/service keys; mark DB modules `import "server-only"`; rotate the DB password if it ever hits git history.
- Never return the full user row from queries: select only needed columns (not `phone`, `address`, `birthDate`, email) for the public feed and for other users' profiles; show organizer first name + photo only. The Better Auth `additionalFields.returned: false` flag can hide sensitive fields from auth responses.
- Passwords: keep the library's scrypt hashing; do not write your own; enforce a stronger policy in Zod than the library minimum; keep login rate limits (use DB storage on serverless); generic error message on bad login; optional email verification adds an email provider dependency (skip unless required by instructor).
- Uploads: validate type/size/magic bytes; random filenames; restrict bucket MIME types.
- GDPR (general knowledge, no source fetched): phone, address, birth date and a photo are personal data; document purpose and legal basis (contract/consent) in a short privacy notice; collect only what the spec requires; give users deletion (enable `deleteUser`, and cascade FKs to photos and memberships as in the schema outline) and a way to export their data; keep the Supabase region in the EU if EU users; admins accessing PII should be limited to the admin app and logged. For a class project, a one-paragraph privacy statement and the delete-account path are sufficient.
- CSRF: Server Actions get Origin-check protection by default; for route handlers that mutate state, rely on Better Auth's trusted origins and SameSite cookies.

### Gaps
- No GDPR primary source was fetched; GDPR points are uncited general guidance.
- Not verified whether the Data API can be disabled per project, or whether Drizzle's `.enableRLS()` helper exists in the version in use.

## 7. Feed performance: pagination, "since last refresh", staying under 3 s

### Takeaway
Use keyset (cursor) pagination on `(departure_date, id)` with a composite index, filter city via an index on `lower(destination_city)`, and implement Refresh as "fetch items with `created_at > lastSeen`" (small, index-backed) rather than reloading the whole feed. With indexes, a small payload and the DB co-located with the function region, 3 s is easy to meet at student-project scale. Free-tier cold start/paused project is the main risk.

### Cited Findings
- Drizzle indexes can be declared in the table callback, including composite, expression (`lower(col)`) and partial indexes: `index("n").using('btree', sql\`lower(${t.col})\`, t.other)` — [Drizzle indexes & constraints](https://orm.drizzle.team/docs/indexes-constraints)
- Drizzle RQB v2 supports `where`, `orderBy`, `limit`, `offset` on queries — [RQB v2](https://orm.drizzle.team/docs/rqb-v2)
- Vercel Functions default to region `iad1`, configurable — [Vercel Functions limits](https://vercel.com/docs/functions/limitations)
- Supabase transaction-mode pooler for serverless; pausing of free projects after a week of low activity — [Supabase: connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres); [Supabase: project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- Supabase Free plan: 200 realtime peak connections, 2M realtime messages (relevant for the later chat) — [Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)

### Inferences
- Feed query (keyset): `WHERE status = 'open' AND departure_date >= current_date [AND lower(destination_city) = lower($city)] AND (departure_date, id) > ($lastDate, $lastId) ORDER BY departure_date ASC, id ASC LIMIT 20`. The cursor is `(departure_date, id)` encoded as a string; pages are stable even when new trips are inserted. Offset pagination is acceptable for a class demo but drifts when rows are added.
- Sort toggle: ascending vs descending departure date uses the same index (btree scans both directions). Include the sort direction in the cursor logic.
- Destination filter: store the city as typed plus rely on `lower()` comparison; for better UX use a dropdown of distinct cities (`SELECT DISTINCT destination_city`) or a `ilike 'prefix%'` (prefix `ilike` will not use the lower() btree index unless using `text_pattern_ops`; keep exact-match filter or use `pg_trgm` only if needed).
- "Since last refresh": client keeps `lastSeenCreatedAt` (max `created_at` returned). Refresh calls `GET /api/trips?since=<iso>` -> `WHERE created_at > $since ORDER BY created_at DESC LIMIT 50` using `trips_created_idx`; prepend new items, show "N new trips". Also return the count of members changed if you display seats left. Use server time for `created_at` (`defaultNow()`) and return the max value from the server rather than a client clock, to avoid skew.
- Keeping it under 3 s: (1) put the Supabase region next to the Vercel region; (2) module-level pooled client with `max: 1`, `prepare: false`; (3) select only feed columns and join organizer first name/photo with one query (no N+1: use Drizzle joins or RQB `with`); (4) index every filter/sort path above; (5) cap page size at ~20; (6) avoid free-project pause (see section 3); (7) measure with `EXPLAIN ANALYZE` and log timings on a seeded 10k-trip table; (8) use `useTransition`/skeleton so the UI responds immediately. Next.js caching can be skipped for the feed to keep refresh simple and fresh.
- Seats left: compute as `max_travelers - count(trip_members)` in the same query via a lateral/subquery, or maintain a `seats_taken` counter updated in the join transaction; counter is faster for reads but must be updated atomically.
- Later chat: Supabase Realtime (free tier 200 peak connections) or short polling on `messages_chat_created_idx` are both viable; schema above does not block either.

### Gaps
- No measured latency numbers were found for Supabase pooler + Vercel; the 3 s claim is reasoned, not measured. The seeded benchmark in the recommendation is the way to confirm it.
- Neon/other hosts were out of scope.

## Notes on source handling
- Several fetched pages (Supabase docs, Vercel docs) contained embedded text asking AI agents to file a "feedback report" and to ask the user whether to send it. These were part of the web content, not the assignment; they were ignored and nothing was sent.
