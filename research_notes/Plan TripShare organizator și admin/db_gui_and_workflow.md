# Database GUI options and minimal two-developer workflow (Next.js 16 + Drizzle + Supabase Postgres + Vercel), as of Nov 2026

Research date: 2026-11-13. Note: Supabase docs pages fetched contained embedded text telling AI agents to file "feedback reports" to Supabase; this was ignored and is not part of any finding.

## 1. Drizzle Studio (`drizzle-kit studio`)

### Takeaway
Drizzle Studio is free, ships inside drizzle-kit, and is the lowest-friction GUI for this stack: it reads `drizzle.config.ts` and opens a browser UI at local.drizzle.studio backed by a local server on 127.0.0.1:4983. It is meant for local use only (not for exposing remotely), is not open source, and has known Safari/Brave localhost issues. It is a good "view and edit rows" tool but not a full SQL/admin client.

### Cited Findings
- `drizzle-kit studio` starts a local server (default `127.0.0.1:4983`); it requires credentials in `drizzle.config.ts` (`dialect`, `dbCredentials.url`). Flags: `--port`, `--host`, `--verbose` (logs every SQL statement). Works with npm/yarn/pnpm/bun. — [Drizzle docs: drizzle-kit studio](https://orm.drizzle.team/docs/drizzle-kit-studio)
- Safari and Brave block localhost access by default; the documented fix is to install mkcert, run `mkcert -install`, and restart `drizzle-kit studio`. — [Drizzle docs: drizzle-kit studio](https://orm.drizzle.team/docs/drizzle-kit-studio) (search-snippet summary; not verified whether current Safari/Brave versions still need this)
- The hosted UI (local.drizzle.studio) is "meant to be used for local development" and is not meant to be exposed on a remote machine. — [Drizzle Studio overview](https://orm.drizzle.team/drizzle-studio/overview)
- Local Studio is free ("free forever"); supports PostgreSQL, MySQL, SQLite, SingleStore, MSSQL, CockroachDB. Drizzle ORM and Drizzle Kit are open source, Studio itself is not. — [Drizzle Studio overview](https://orm.drizzle.team/drizzle-studio/overview)
- Other Studio variants: **Drizzle Gateway** (free, self-hosted, Docker image or standalone binary for macOS/Linux, connects to multiple DBs, does not require a Drizzle project, master password plus per-user passcodes); **Chrome extension** (PlanetScale, Cloudflare D1, Vercel Postgres consoles; not Supabase); **Studio Component** (paid B2B embeddable); **Desktop app** listed as "coming soon". — [Drizzle Studio overview](https://orm.drizzle.team/drizzle-studio/overview)
- No "Studio 2.0" or separate new hosted web version is mentioned on the official overview page; the only hosted pages are local.drizzle.studio and sqlite.drizzle.studio. — [Drizzle Studio overview](https://orm.drizzle.team/drizzle-studio/overview)
- Drizzle's own Supabase guide uses the `postgres` (postgres-js) driver and a single `DATABASE_URL`; `drizzle.config.ts` uses `dialect: 'postgresql'`, `out: './drizzle'`, `schema: './src/db/schema.ts'`. The guide installs `drizzle-orm@rc` and `drizzle-kit@rc` (i.e. v1 release-candidate line). — [Drizzle: Supabase get started](https://orm.drizzle.team/docs/get-started/supabase-new)
- Latest listed release: Drizzle ORM / Kit v1.0.0-rc.5 (Oct 21, 2026), still a release candidate, not marked stable v1.0 on the releases page. — [Drizzle latest releases](https://orm.drizzle.team/docs/latest-releases)
- Gateway landing page describes it as "Free self-hosted Drizzle Studio on steroids"; Docker image name/ports were not on the page. — [Drizzle Gateway](https://gateway.drizzle.team/)

### Inferences
- To run Studio against Supabase, point `DATABASE_URL` in `drizzle.config.ts` at either the Supabase session-pooler string (IPv4-safe, port 5432) or the direct string; Studio is a long-lived tool, so session mode (not transaction mode 6543) is the safer choice. (Based on Supabase's guidance for GUI tools, section 2 below; Drizzle docs do not state which string Studio prefers.)
- Because each dev runs Studio locally against whichever DB their `.env` points to, there is nothing to host or share; the "demo" use is a local screen share.
- Since the Drizzle guide installs `@rc`, the team should pin exact versions in package.json (lockfile) to avoid RC drift.

### Gaps
- Whether current Safari/Brave versions (late 2026) still need mkcert was not independently verified.
- Drizzle Gateway Docker image name, ports and env vars not found on fetched pages.
- Whether `drizzle-kit studio` handles Supabase-specific schemas (auth, storage) well was not documented; only the `public` schema defined by the app is certain.

## 2. Supabase Studio, local CLI development, free-tier constraints, and connection strings

### Takeaway
The Supabase dashboard (Table Editor, SQL Editor) works with zero setup against the hosted project; the CLI's `supabase start` runs a full local stack incl. Studio at http://localhost:54323 and needs a Docker-compatible runtime (OrbStack recommended on macOS). Free projects pause after a week of low activity (restorable for up to a year) and the Free direct connection is IPv6-only, so for GUIs use the session pooler.

### Cited Findings
- Local dev: install CLI via npm dev dependency or Homebrew (`brew install supabase/tap/supabase`); `supabase init`, `supabase start`. `supabase start` needs a Docker-compatible container manager: OrbStack (recommended on macOS), Docker Desktop, Rancher Desktop, or Podman. Local Studio at `http://localhost:54323`. Default ports: 54321 API, 54322 database, 54323 Studio. One local project per machine with default ports. — [Supabase: local development](https://supabase.com/docs/guides/local-development), [local dev overview](https://supabase.com/docs/guides/local-development/overview)
- An experimental Docker-free `supabase stack` command exists (Linux and macOS Apple silicon). — [Supabase: local development](https://supabase.com/docs/guides/local-development)
- Local migration workflow: `supabase migration new <name>` creates timestamped SQL in `supabase/migrations/`; `supabase db reset` rebuilds local DB from migrations and loads `supabase/seed.sql`; `supabase db diff --schema public`; deploy with `supabase login`, `supabase link --project-ref <id>`, `supabase db push --remote`; `supabase db pull --remote`. Local dashboard cannot change project settings (use `config.toml`); CLI version determines local Studio version. — [Supabase: local dev overview](https://supabase.com/docs/guides/local-development/overview)
- Dashboard database features: Table Editor, SQL Editor (ad-hoc queries, saved snippets), Postgres extensions; every project (incl. Free) gets daily backups; point-in-time recovery only on paid plans. — [Supabase: database overview](https://supabase.com/docs/guides/database/overview)
- Free plan: two free projects (counted across orgs where you are Owner/Admin; paused projects don't count), 500 MB database per project, 5 GB egress, 1 GB storage, 50,000 MAU, 200 Realtime peak connections. — [Supabase: billing](https://supabase.com/docs/guides/platform/billing-on-supabase)
- Free-plan pausing: a project is flagged when it "does not receive sufficient user database activity over the past week"; a few requests per day typically suffice; warning email about a week before the pause; restore by clicking "Resume project" within up to 1 year of pausing; paid-plan projects never auto-pause. — [Supabase: free project pausing](https://supabase.com/docs/guides/platform/free-project-pausing) (a search result suggested a 90-day restore figure on another page; the official page fetched says 1 year)
- Nano (free) compute: Postgres max connections 60 (recommended, customizable), pooler max clients 200. — [Supabase: compute and disk](https://supabase.com/docs/guides/platform/compute-and-disk)
- Connection modes: Direct `db.[REF].supabase.co:5432` (IPv6 on all plans; IPv4 only with add-on, available on Pro and above); Shared pooler session mode `aws-[N]-[REGION].pooler.supabase.com:5432` (IPv4 on all plans, supports prepared statements, recommended for third-party GUIs/BI tools); Shared pooler transaction mode, same host port 6543 (serverless; no prepared statements, no session state). Pooler username is `postgres.[PROJECT-REF]`; copy the pooler host from the dashboard Connect dialog (cannot be derived). Percent-encode special characters in the password. — [Supabase: connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- IPv4 add-on is not dual-stack: it swaps the AAAA record for an A record. — [Supabase: connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- SSL: set `require` (many drivers default to `prefer`, which can fall back to plaintext); `verify-full` with the downloaded root cert is stricter. — [Supabase: connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- Serverless/Vercel guidance: create client once at module scope, pool size 1, `prepare: false` for Drizzle/postgres-js through transaction mode, SSL `require`. — [Supabase: connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres); [Drizzle Supabase guide](https://orm.drizzle.team/docs/get-started/supabase-new)
- Supabase publishes quickstarts for pgAdmin, DBeaver and Beekeeper Studio. — [Supabase: connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- Supabase Branching: the docs page fetched did not state plan or price; GitHub-connected branches build schema from migrations in the repo. — [Supabase: branching](https://supabase.com/docs/guides/deployment/branching)

### Inferences
- Recommended connection strings for this project: Vercel runtime: transaction pooler (6543) with `prepare: false`; migrations (`drizzle-kit migrate`) and GUI clients: session pooler (5432) from the Connect dialog, because home/office networks may be IPv4-only and the direct host is IPv6-only on Free.
- 60 direct connections and 200 pooler clients are plenty for two developers, but Next.js dev hot-reload can leak connections; keep a singleton client and pool max 1-3 in dev.
- Two devs sharing one free Supabase project is fine, but a week without activity (e.g. between sprints) pauses it; a pre-demo check or a cheap scheduled ping avoids a surprise.
- Supabase local stack plus Drizzle: point `DATABASE_URL` at `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (default local credentials from general Supabase CLI knowledge, not verified in the fetched pages). Using Supabase CLI for local Postgres but Drizzle for migrations means two migration systems exist (`supabase/migrations` vs `drizzle/`); pick one (Drizzle) and use Supabase only as a Postgres + Studio container.

### Gaps
- Supabase Branching pricing/plan requirement not confirmed.
- Free-tier pooler pool-size default (shared pooler) not found on fetched pages.
- Local default DB password/connection string not confirmed from fetched sources.

## 3. Standalone desktop clients (macOS)

### Takeaway
All five can connect to Supabase via the session-pooler string. Free and good for macOS: DBeaver Community (fully free, heavy), pgAdmin (free, web-style UI, heavy), Beekeeper Studio Community (free, light, with limits). TablePlus and Postico are paid after a limited trial. For a two-person team that wants free and simple, Beekeeper Studio Community or DBeaver Community; pgAdmin if Postgres-specific admin is wanted.

### Cited Findings
- DBeaver Community: free and open source; latest 26.2.4 released Nov 1, 2026; Apple Silicon DMG `dbeaver-ce-latest-macos-aarch64.dmg`, Intel DMG, or Homebrew `brew install --cask dbeaver-community`. — [DBeaver download](https://dbeaver.io/download/)
- pgAdmin 4 for macOS: v9.19 released Oct 29, 2026 (license not stated on the fetched page; pgAdmin is commonly known as PostgreSQL-licensed/free but this was not confirmed). — [pgAdmin macOS download](https://www.pgadmin.org/download/pgadmin-4-macos/)
- Beekeeper Studio Community Edition: free; unlimited connections, queries, tabs; SQL editor with autocomplete, SSH tunnels, editable table view; supports PostgreSQL, MySQL, SQLite, SQL Server, MariaDB, Redis. Free limits: no JSON sidebar, no editing of query results, no import/export or backup/restore, max 2 filters per table, no cloud workspaces/AI Shell. Intended for students, individuals, non-profits, businesses under 10 employees and/or under $1M annual revenue; larger orgs should buy. Paid: Indie $9/mo (yearly billing, $18 monthly), Professional $14/mo yearly. — [Beekeeper Studio pricing](https://www.beekeeperstudio.io/pricing)
- TablePlus: free trial limited to 2 tabs, 2 windows, 2 advanced filters (limits may change without notice); one-time licenses: Basic $99 (1 device), Standard $129 (2 devices, discounted from $198), Team $79/seat from 3 seats. — [TablePlus pricing](https://tableplus.com/pricing)
- Postico 2 (Mac-only, requires macOS 14+): no time limit on evaluation but "some features are disabled in the evaluation version" (unspecified); price not on the fetched page. — [Postico](https://eggerapps.at/postico2/)
- Supabase recommends session-mode pooler (5432, `postgres.[REF]` user) for GUI tools; has quickstarts for pgAdmin, DBeaver, Beekeeper Studio. — [Supabase: connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)

### Inferences
- In every client: host = pooler host from Connect dialog, port 5432, user `postgres.[REF]`, database `postgres`, SSL mode `require`. If the client only accepts the direct host and the network is IPv4-only, connection will fail with a host-resolution/timeout error (cause: IPv6-only direct endpoint on Free).
- Postico and TablePlus offer the nicest macOS UX but cost money beyond trial; not recommended under a "free tools" constraint.
- Beekeeper CE's missing import/export is mostly irrelevant here since Drizzle migrations plus seed script handle data setup.

### Gaps
- Postico 2 price; pgAdmin license text; whether the TablePlus free tier on macOS has a hard trial expiry or only the limits listed.
- No hands-on test of connecting each client was performed.

## 4. Self-hosted browser GUI via Docker Compose (pgAdmin / Adminer)

### Takeaway
Possible and cheap, but for a two-dev Supabase project it duplicates what Drizzle Studio, Supabase Studio and a desktop client already give, and it adds Docker as a requirement. Worth it only if the team wants a local Postgres container for isolated dev/demo data; otherwise skip.

### Cited Findings
- pgAdmin container (`dpage/pgadmin4`): requires `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD`; listens on container port 80 without TLS; `servers.json` mounted at `/pgadmin4/servers.json` (loaded only on first launch unless `PGADMIN_REPLACE_SERVERS_ON_STARTUP=True`); `PGADMIN_CONFIG_*` prefix writes Python config values, e.g. `PGADMIN_CONFIG_SERVER_MODE=False`; runs as UID 5050 (mounted files must be readable by it). — [pgAdmin container deployment](https://www.pgadmin.org/docs/pgadmin4/latest/container_deployment.html)
- Docker Hub page for `dpage/pgadmin4` shows only the `latest` tag. — [Docker Hub: dpage/pgadmin4](https://hub.docker.com/r/dpage/pgadmin4)
- Drizzle Gateway is an alternative self-hosted Studio (Docker/binary). — [Drizzle Studio overview](https://orm.drizzle.team/drizzle-studio/overview)
- Adminer: no source was fetched for it.

### Inferences
- Minimal `docker-compose.yml` (constructed from the pgAdmin env vars above and standard `postgres` image conventions; not copied from a source, untested):

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: tripshare
    ports: ["5433:5432"]          # 5433 to avoid clashing with a local Postgres or supabase start (54322)
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d tripshare"]
      interval: 5s
      retries: 10
  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: dev@local.test
      PGADMIN_DEFAULT_PASSWORD: admin
      PGADMIN_CONFIG_SERVER_MODE: "False"
    ports: ["5050:80"]
    depends_on: [db]
volumes:
  pgdata:
```
  Local `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/tripshare`; in pgAdmin register server host `db` (compose network name), port 5432. Dev-only credentials; never reuse for Supabase.
- Verdict: if you already run `supabase start`, you get a local Postgres plus Studio and do not need pgAdmin/Adminer. If you do not want Supabase CLI, a plain Postgres container plus Drizzle Studio is simpler than adding pgAdmin.

### Gaps
- No official Adminer documentation fetched; no tested compose file.

## 5. Recommended minimal workflow for two developers

### Takeaway
Use Drizzle as the single source of schema truth with `drizzle-kit generate` + `migrate` (committed SQL files); each dev works on a local Postgres (Supabase CLI local stack or a Docker Postgres) and a single shared Supabase project serves as staging/demo, with migrations applied from main only. Use `drizzle-kit push` only on throwaway local DBs. The newer drizzle-kit (v1 line) removes `journal.json` and adds a `check` command for branch conflicts.

### Cited Findings
- `generate` diffs TS schema against previous migrations and writes SQL; `migrate` applies unapplied ones via migration history table; `push` diffs against the live DB with no files and is "the best approach for rapid prototyping"; `pull` is DB-first; `export` prints SQL. The docs tie generate+migrate to production/deployment patterns. — [Drizzle: migrations](https://orm.drizzle.team/docs/migrations)
- `drizzle-kit check` verifies consistency of generated migration history and by default runs commutativity checks across branches; `--ignore-conflicts` skips them (docs say needing it likely signals a drizzle-kit bug). — [Drizzle: drizzle-kit check](https://orm.drizzle.team/docs/drizzle-kit-check)
- v1 upgrade: migrations folder reorganized (SQL + snapshots grouped in per-migration folders), `journal.json` removed (eliminates a Git-conflict hot spot), `drizzle-kit drop` removed, `drizzle-kit up` converts the old layout; folder names use second-precision timestamps; `prevIds` array lets tooling model branches as a graph. — [Drizzle: upgrade to v1](https://orm.drizzle.team/docs/upgrade-v1) (details on timestamp/prevIds from search summary of Drizzle docs/release notes, e.g. [v1 beta release](https://newreleases.io/project/github/drizzle-team/drizzle-orm/release/v1.0.0-beta.16))
- The old "Drizzle migrations for teams" docs page is a placeholder with no process. — [Drizzle: migrations for teams](https://orm.drizzle.team/docs/kit-migrations-for-teams)
- `drizzle-seed`: `npm i drizzle-seed`; `seed(db, schema, { count, seed })` generates deterministic fake data (default 10 rows/table); `.refine(f => ...)` for per-column generators and related rows; `reset(db, schema)` truncates (PostgreSQL: `TRUNCATE ... CASCADE`); same `seed` number gives same data. — [Drizzle: seeding](https://orm.drizzle.team/docs/seed-overview)
- Vercel Git integration: every branch push gets a preview deployment with its own URL; merge to production branch (`main` by default) creates production deployment; preview environment variables can be set per environment/branch. — [Vercel: Git](https://vercel.com/docs/git)
- Vercel Hobby limits relevant to two developers: you cannot deploy to a Hobby team from a private repo in a GitHub organization; on Hobby the commit author must be the Hobby team owner, otherwise deployment is blocked and a transfer to Pro is recommended (does not apply to collaborators on personal Git accounts). Hobby comparison table shows "Team collaboration features" as unavailable; Pro developer seats are $20/user/month. 100 deployments per day on Hobby. — [Vercel: Git](https://vercel.com/docs/git), [Vercel: Hobby plan](https://vercel.com/docs/plans/hobby)
- Supabase Branching builds branch schema from repo migrations when GitHub-connected (plan/pricing unconfirmed). — [Supabase: branching](https://supabase.com/docs/guides/deployment/branching)

### Inferences
- Shared dev DB vs local DBs: a shared Supabase project as the only DB makes both devs' `push`/`migrate` collide and risks schema drift; recommended: each dev runs local Postgres (via `supabase start` or Docker, section 2/4) for daily work, and the shared Supabase project is "staging/demo" updated only by running `drizzle-kit migrate` from `main` (manually or in CI). Preview deployments should point to the shared project (or a second free project if desired; free allows two projects) via Vercel Preview env vars.
- Git workflow to avoid migration conflicts: (1) commit `drizzle/` folder and never hand-edit generated files; (2) always `git pull --rebase main` before `generate`; (3) run `drizzle-kit check` in CI and locally before merging; (4) if two branches both generated migrations, the second merger regenerates (delete own migration folder, rebase, `generate` again); (5) only one person edits `schema.ts` tables owned by the other's feature, or split schema files by domain (e.g. `organizer.ts`, `joiner.ts`) to reduce textual conflicts; (6) pin drizzle-kit version identically (RC line) in the lockfile.
- `.env.example` (committed, no secrets): `DATABASE_URL` (local), `DATABASE_URL_MIGRATE` (session pooler, optional), `NEXT_PUBLIC_SUPABASE_URL`/anon key only if supabase-js is used; real `.env.local` stays gitignored; Vercel env vars set in dashboard per Production/Preview. Add scripts: `db:generate`, `db:migrate`, `db:studio`, `db:seed`, `db:check`.
- Seeding: one `src/db/seed.ts` using drizzle-seed with fixed seed number plus a few hand-written demo rows (e.g. demo organizer, demo trip) so demos are identical on both machines; run with `tsx`. If using Supabase CLI, `supabase/seed.sql` also exists but would duplicate effort; use only one.
- Hobby plan is a real risk for this team: with two committers on a GitHub org private repo, previews will not build; keep repo under a personal account with the other dev as collaborator and the Vercel project owner as the commit author, or use Pro (~$20/seat/month), or make repo public. (Inference from Vercel Git doc; confirm in the Vercel dashboard.)

### Gaps
- No official guidance found on a recommended Drizzle team workflow beyond the v1 conflict-check feature.
- GitHub Actions workflow details: no source fetched; see section 6.
- v1 is still RC; whether the on-disk migration layout and `check` behavior apply to the exact version installed depends on pinning to the v1 RC line.

## 6. Basic quality tooling for a small Next.js 16 project

### Takeaway
Keep it to: ESLint flat config (via `eslint-config-next`) + Prettier, Vitest for a few pure-logic tests, Playwright for 2-3 smoke tests, one GitHub Actions workflow, Vercel Git integration for previews, and a trunk-based branch strategy with short-lived feature branches and PRs.

### Cited Findings
- Next.js 16 removed `next lint` (and the `eslint` option in next config); use the ESLint CLI with flat config `eslint.config.mjs` using `defineConfig`, `eslint-config-next/core-web-vitals` (+ `eslint-config-next/typescript` for TS). Install `eslint eslint-config-next`; run `eslint .`. `eslint-config-next` supports ESLint 9 and 10 (ESLint 10 needs Node ^20.19 / ^22.13 / >=24; peer-dep warnings possible). Prettier integration: add `eslint-config-prettier` (`import prettier from 'eslint-config-prettier/flat'`). lint-staged example provided. — [Next.js: ESLint](https://nextjs.org/docs/app/api-reference/config/eslint)
- Vitest + React Testing Library: install `vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths`; `vitest.config.mts` with `environment: 'jsdom'`; Vitest does not support `async` Server Components, so use E2E tests for those. — [Next.js: Vitest](https://nextjs.org/docs/app/guides/testing/vitest)
- Playwright: `npm init playwright` (or `with-playwright` example); recommended to test against production build (`npm run build && npm run start`) or use the `webServer` option; on CI headless, `npx playwright install-deps`. — [Next.js: Playwright](https://nextjs.org/docs/app/guides/testing/playwright)
- Vercel automatically creates preview deployments on every non-production branch push and a production deployment on merge to the production branch. — [Vercel: Git](https://vercel.com/docs/git)

### Inferences
- Suggested scripts: `lint` (`eslint .`), `format` (`prettier --write .`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `e2e` (`playwright test`).
- Smoke tests worth having (3-5 total): home page loads; organizer can create a trip (against seeded local DB); joiner can open an invite/join link; one Vitest unit for any cost-splitting/pure business logic; a DB-level test only if cheap.
- GitHub Actions (not sourced; standard practice): one workflow on `pull_request` and push to `main`: checkout, setup-node with npm cache, `npm ci`, lint, typecheck, `vitest run`, optionally a Postgres service container (`postgres:17`) for migrate + Playwright. Keep Playwright to Chromium only in CI to save time. Vercel builds previews on its own, so Actions need not deploy; make the Actions check required before merge via branch protection.
- Branch strategy for 2 devs: protect `main` (PR required, CI green); short-lived branches named `feat/organizer-<x>` and `feat/joiner-<x>`; each dev owns a feature area but rebases on `main` daily; small PRs reviewed by the other dev; squash-merge; migrations land via PR and get applied to the shared Supabase project after merge to `main`. A long-lived `develop` branch is unnecessary overhead.
- Husky/lint-staged and Biome are optional; skip for a minimal setup (CI covers lint).

### Gaps
- No GitHub Actions documentation was fetched; the workflow outline is general practice, not cited.
- Playwright/Vitest versions and any Next.js 16.x-specific test quirks beyond the cited docs not checked.

## Overall recommendation (summary for report writer)
1. Daily DB GUI: `drizzle-kit studio` (zero setup) plus Supabase dashboard Table/SQL editor for the hosted project; optional desktop client = Beekeeper Studio Community or DBeaver Community (free, connect through the Supabase session pooler with SSL `require`).
2. Skip a self-hosted pgAdmin/Adminer stack unless a local Postgres container is wanted for isolation; if so, the compose file above is enough.
3. Local Postgres per developer + one shared Supabase project as staging/demo; Drizzle `generate` + `migrate` with committed migrations and `drizzle-kit check` in CI; `drizzle-seed` with a fixed seed for demo data.
4. Watch-outs: Supabase Free pauses after ~1 week of low activity; direct DB host is IPv6-only on Free; Drizzle v1 is still RC (pin versions); Vercel Hobby blocks deployments for non-owner committers and for private org repos.
