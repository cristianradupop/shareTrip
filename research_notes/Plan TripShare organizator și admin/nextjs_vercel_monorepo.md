# Two-app monorepo (Next.js 16 + React 19 + TS + Tailwind 4 + shadcn/ui) on Vercel, as of 13 Nov 2026

Research date: 2026-11-13. Versions below were read from the npm registry on that day (https://registry.npmjs.org/<pkg>) and from nextjs.org / vercel.com / ui.shadcn.com docs fetched the same day. Where I infer rather than cite, it is in "Inferences".

## 1. Latest stable Next.js 16 minor and breaking changes vs 15 (which affect a simple CRUD app?)

### Takeaway
Latest stable is Next.js 16.4.x (npm `latest` = 16.4.6, published 2026-11-09), shipping with React 19.3. The 15->16 breaking changes that actually touch a CRUD app are: fully async request APIs (`await params/searchParams/cookies()/headers()`), `middleware.ts` -> `proxy.ts` (Node runtime), Turbopack as default bundler, `next lint` removed, `revalidateTag` second argument, Node >= 20.9. The big trap for 2026 is that `create-next-app` now enables Cache Components by default (since 16.4), which changes how request-time DB reads must be written (Suspense) - for a student CRUD app you should consciously decide whether to keep it.

### Cited Findings
- npm dist-tag `latest` for `next` is 16.4.6 (published 2026-11-09T20:33Z); 16.4.0 was published 2026-10-06; `react` latest is 19.3.1; `tailwindcss` latest 4.3.5; `shadcn` CLI latest 4.23.0; `turbo` 2.11.11; `typescript` latest 7.0.2; `postgres` (postgres.js) 4.1.1; `drizzle-orm` latest 0.45.4 / `drizzle-kit` latest 0.31.11 (with `rc` tag 1.0.0-rc.5 for both). — [npm registry: next](https://registry.npmjs.org/next), [react](https://registry.npmjs.org/react), [drizzle-orm](https://registry.npmjs.org/drizzle-orm), [drizzle-kit](https://registry.npmjs.org/drizzle-kit)
- `next@16.4.6` requires Node >= 20.9.0 and peers `react ^18.2.0 || ^19.0.0`. — [npm: next/16.4.6](https://registry.npmjs.org/next/16.4.6)
- Release timeline: Next.js 16 (2025-10-21), 16.1 (2025-12-18), 16.2 (2026-03-18), 16.3 (2026-08-03; "Instant Navigations"), 16.4 (2026-10-06). Monthly scheduled security releases exist (Aug 25, Sep 30, Nov 3 2026) plus out-of-band updates (Sep 22, Oct 14) - keep `next` patched. — [Next.js blog index](https://nextjs.org/blog)
- Next.js 16.4: "Cache Components ... will become the default in Next.js 17"; "all new apps created with `create-next-app` will have Cache Components enabled by default"; ships React 19.3; Cache Components is enabled with `cacheComponents: true` and `partialPrefetching: true` in `next.config.ts`. — [Next.js 16.4 blog](https://nextjs.org/blog/next-16-4)
- `create-next-app` recommended defaults: "TypeScript, ESLint, No React Compiler, Tailwind CSS, No src/ directory, App Router, Cache Components, AGENTS.md, Agent feedback"; flags include `--cache-components` ("default for App Router"), `--react-compiler`, `--biome`, `--no-linter`, `--use-pnpm`, `--src-dir`, `--import-alias`, `--yes`, `--empty`, `--api`. — [create-next-app docs](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
- With Cache Components, "data fetching is dynamic by default" and you opt into caching with `'use cache'`; Next prerenders a static shell with dynamic parts streaming in. It "requires the Node.js runtime and does not support the `runtime` route segment config" (remove any `runtime = 'edge'`/`'nodejs'` export). Also uses React `<Activity>` to keep hidden routes' state on client navigation (component state preserved when navigating back; effects cleaned up). — [cacheComponents docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- The v16 upgrade guide warns that enabling `cacheComponents` "is not a rename-only change: it can surface build errors for uncached data outside of `<Suspense>`", and its checklist says "React Compiler and Cache Components are not enabled merely to complete the upgrade". — [Upgrade to v16 guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Breaking changes in 16 (official list): Node 20.9+, TypeScript 5.1+, browsers Chrome/Edge/Firefox 111+, Safari 16.4+; sync access to `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` fully removed (must `await`); `middleware` filename deprecated -> `proxy` (Node.js runtime only, not configurable; edge only via legacy `middleware`); Turbopack default for `next dev` AND `next build` (build fails if a custom `webpack` config is present unless `--webpack`/`--turbopack`); `next lint` removed (use ESLint CLI/Biome; `next build` no longer lints); `serverRuntimeConfig`/`publicRuntimeConfig` removed (use env vars); `revalidateTag(tag, profile)` now requires 2nd arg (single-arg deprecated); new `updateTag()` (Server Actions only, read-your-writes) and `refresh()`; parallel route slots need `default.js`; `next/image` defaults changed (minimumCacheTTL 4h, qualities [75], local query-string srcs need `localPatterns`, max 3 redirects); AMP removed; ESLint flat config default. — [Next.js 16 blog](https://nextjs.org/blog/next-16), [Upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- Codemods: `npx @next/codemod@canary upgrade latest` (handles turbopack config, next-lint migration, middleware->proxy, removes `unstable_` prefixes); async request APIs need separate `npx @next/codemod@canary next-async-request-api .`; `npx next typegen` generates global `PageProps<'/route'>`, `LayoutProps`, `RouteContext` helper types (introduced 15.5). — [Upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- React Compiler support is stable in Next 16 but NOT enabled by default (`reactCompiler: true` + `babel-plugin-react-compiler`); expect higher build/dev compile times because it relies on Babel. A Rust-based experimental version exists since 16.3 (`experimental.turbopackRustReactCompiler`). — [Next.js 16 blog](https://nextjs.org/blog/next-16), [Next.js 16.4 blog](https://nextjs.org/blog/next-16-4)
- Pattern recommended for new projects: a server-only Data Access Layer (DAL) doing auth checks and returning DTOs; mark with `import 'server-only'`. Server Actions are reachable by direct POST so must re-check auth/authorization inside each action; return only what the UI needs. — [Data security guide](https://nextjs.org/docs/app/guides/data-security)
- Next.js 16.4 `partialPrefetching` is documented as to-be-enabled-everywhere in the next major; setting `cacheComponents` without setting `partialPrefetching` explicitly logs a warning. — [cacheComponents docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)

### Inferences
- For a CRUD app the must-do items are: `await` params/cookies/headers; name the file `proxy.ts` (exported function `proxy`) if you need a route guard; don't use `next lint` in scripts; use `revalidatePath` or `updateTag` after mutations (`revalidatePath` was not changed by 16 per the docs I read).
- Decision to flag: the scaffold default now turns Cache Components on. A user-facing landing page benefits (static shell + streamed dynamic); an admin CRUD panel gets little from it and must wrap every request-time read (DB query, `cookies()`) in `<Suspense>` or the build errors. Simplest for beginners: scaffold with `--no-cache-components`-style choice (answer "No" in the custom prompt) for the admin app, or keep it on and follow the Suspense pattern consistently. Either is supported; mixing is fine per-app because each app has its own `next.config.ts`. I did not find an explicit `--no-cache-components` flag documented, but the generic `--no-*` negation is documented ("Negate default options").
- Cache Components being the declared default in Next 17 argues for learning it now, but it is optional for a student deliverable.
- `typescript` npm `latest` is 7.0.2; Next.js docs only state a floor of TS 5.1. I did not verify Next 16.4 + TS 7 compatibility; pin whatever `create-next-app` installs rather than blindly bumping.

### Gaps
- Exact Next 16.4 `package.json` TypeScript version produced by `create-next-app` was not verified (I did not run the scaffold).
- Did not read the 16.1/16.2/16.3 release notes in detail (only titles/dates); none of the headlines (Adapters API stable in 16.2, Instant Navigations in 16.3) are required for CRUD.
- Whether `create-next-app` offers a documented non-interactive flag to turn Cache Components off: only the `--no-*` generic negation is documented.

## 2. Monorepo options (pnpm workspaces vs Turborepo vs single app with route groups) and two-project Vercel deploy

### Takeaway
Vercel supports multiple projects from one Git repo (one Vercel Project per app directory, each with its own Root Directory), up to 25 projects per repo on Hobby, and automatically skips builds of unchanged projects when the repo uses npm/yarn/pnpm/Bun workspaces - Turborepo is not required for that. Simplest structure that literally satisfies "two modules named server-app and server-admin" plus a shared Drizzle `db` package is a plain pnpm workspace (`apps/server-app`, `apps/server-admin`, `packages/db`, optional `packages/ui`); Turborepo is optional sugar. A single Next app with route groups is simpler still, but does not give two named deployable modules.

### Cited Findings
- To deploy a monorepo on Vercel you create one Project per directory: Create New -> Project -> import the repo -> edit Root Directory -> Deploy, then repeat per app; every commit then deploys all connected projects. — [Vercel: Using Monorepos](https://vercel.com/docs/monorepos)
- Projects connected to the same Git repo are limited by plan: Hobby 25, Pro 150. Hobby also: 100 deployments/day, 1 concurrent build, 200 projects total, 45-minute build limit. — [Vercel limits](https://vercel.com/docs/limits)
- Vercel auto-skips unchanged projects ("Skipping unaffected projects"): a project counts as changed if its source, any internal workspace dependency, or a lockfile change affecting its deps changed. Requirements: GitHub-connected repo; npm/yarn/pnpm/Bun workspaces (`pnpm-workspace.yaml` or `workspaces`); every workspace package has a unique `name`; inter-package deps declared explicitly in each `package.json`. This does not consume concurrent build slots (unlike Ignored Build Step). Toggle under Settings -> Build and Deployment -> Root Directory -> "Skip deployment". — [Vercel: Using Monorepos](https://vercel.com/docs/monorepos)
- Ignored Build Step is the fallback; builds canceled by it count toward deployment and concurrent build limits. — [Vercel: Using Monorepos](https://vercel.com/docs/monorepos)
- Filtered installs: set a custom Install Command in the app's `vercel.json` e.g. `{"installCommand": "pnpm install --filter web..."}` (docs example uses `apps/web/vercel.json`). — [Vercel: Using Monorepos](https://vercel.com/docs/monorepos)
- Related Projects: a `vercel.json` `relatedProjects: ["prj_..."]` makes the other project's preview/production host available via `VERCEL_RELATED_PROJECTS` (helper pkg `@vercel/related-projects`); max 3 linked projects, same repo only, CLI deployments unsupported. Useful so the admin preview points at the matching API preview. — [Vercel: Using Monorepos](https://vercel.com/docs/monorepos)
- Vercel CLI: `vercel link --repo` links multiple projects from the repo root. — [Vercel: Using Monorepos](https://vercel.com/docs/monorepos)
- Turborepo scaffold: `pnpm dlx create-turbo@latest`; the starter has two deployable apps and three shared libraries under `apps/` and `packages/`; `turbo build --filter=<pkg>`. The Turborepo site is now turborepo.dev (turborepo.com 301-redirects). — [Turborepo installation](https://turborepo.dev/docs/getting-started/installation)
- Hobby teams cannot connect projects to Git repos owned by a GitHub (Git) *organization*: "Vercel does not support connecting a project on your Hobby team to Git repositories owned by Git organizations. You can either switch to an existing Team or create a new one." — [Vercel limits](https://vercel.com/docs/limits)
- Hobby is for personal use: Vercel's plan page shows "Team collaboration features" as "-" for Hobby vs "Yes" for Pro; Pro developer seats cost $20/user/month, Viewer seats free. Vercel's pricing/ToS describes Hobby as personal, non-commercial. — [Hobby plan docs](https://vercel.com/docs/plans/hobby); non-commercial wording seen in search snippets of [Vercel pricing](https://ZEIT.co/pricing) (secondary, not read in full)
- Next 16.4 added experimental `turbopackAdditionalRoots` to follow symlinked workspace packages outside the project root, and notes pnpm global virtual store needs the store dir added as additional root. — [Next.js 16.4 blog](https://nextjs.org/blog/next-16-4)
- A Vercel KB item titled "Vercel Services let you deploy multiple frontends and backends in one project on a shared domain" appears in Vercel's related-links list (title only; I did not read it). — [Vercel plans page](https://vercel.com/docs/plans)

### Inferences
- Recommended: pnpm workspaces, no Turborepo at first. Root `package.json` scripts using `pnpm --filter` (e.g. `pnpm --filter server-app dev`) are enough for two devs. Add Turborepo only if build/lint caching or `turbo dev` orchestration is wanted; the shadcn CLI's `init --monorepo` scaffolds Turborepo anyway, which is a legitimate reason to adopt it (see Q4).
- Since Vercel's skip-unaffected feature works with plain pnpm workspaces, Turborepo's `turbo-ignore` is unnecessary.
- Single Next.js app with route groups `(admin)`, `(user)`, `api/` is the least moving parts (one Vercel project, one deploy, shared auth cookie, no CORS) but fails the stated requirement of two *modules* named `server-app` and `server-admin`; at most it could be a fallback if the assignment grader only looks at folder names. The user should confirm whether "module" means separately deployable.
- Where the "public user web UI + organizer dashboard" lives: the Q's brief says it "will probably live in the same app" - putting it in `server-app` (backend + public UI) and keeping `server-admin` admin-only is consistent with the two-module requirement.
- Hobby plan risk for a two-dev team: the repo cannot be under a GitHub organization, and collaboration/non-commercial limits apply. Practical options: one dev owns the repo under a personal account and the other is a GitHub collaborator, with deployments triggered from the owner's Vercel Hobby account; or create a Pro trial/team. Confirm with Vercel docs for exactly how commits by non-owner collaborators are treated on Hobby (not verified).

### Gaps
- Official statement of how many collaborators a Hobby team can have and whether a second dev's pushes to a personal repo deploy: not found in official docs I read (only search-result secondary claims of "just you"); treat as unverified.
- The exact current Vercel ToS text for "non-commercial" was not fetched; a university project is likely fine, but not confirmed.
- Whether a `vercel.json` placed inside `apps/<name>/` is honored when Root Directory is that folder: the docs example uses `apps/web/vercel.json` with `--filter web...`, which implies yes; not tested.

## 3. `server-app` as Route Handlers/REST (with `server-admin` consuming it) vs Server Actions + shared db package

### Takeaway
Server Actions are same-origin, POST-only RPC endpoints that Next explicitly blocks cross-origin (Origin must match Host unless `allowedOrigins`), so they cannot serve a second domain's UI; a REST API in Route Handlers is the right choice only if `server-admin` genuinely must call `server-app` over HTTP. The least-complexity design that keeps two modules is: both apps import a shared `packages/db` (Drizzle schema + client + a small data-access layer) and each app does its own reads in Server Components and writes via Server Actions; `server-app` additionally exposes Route Handlers only for the public/mobile-style consumers if needed. Cross-domain cookie auth between two Vercel domains is a known pain point best avoided.

### Cited Findings
- Server Actions: "reachable via a direct POST request, not just through your application's UI"; always re-verify auth and authorization inside each action (a page-level check does not cover the action); validate input; return minimal DTOs; protect against IDOR with ownership checks. — [Data security guide](https://nextjs.org/docs/app/guides/data-security)
- CSRF: Server Actions are POST-only and Next compares the `Origin` header host to `Host`/`X-Forwarded-Host`; mismatches are aborted. Extra hosts can be allowed via `experimental.serverActions.allowedOrigins` (supports `*` single-label and `**` multi-label wildcards); the check runs in production too. A request with no Origin header is allowed with a warning. Default body limit is 1 MB (`bodySizeLimit`). — [serverActions config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions), [Data security guide](https://nextjs.org/docs/app/guides/data-security)
- Next.js's own data-fetching guidance: three approaches - "HTTP APIs" (for existing large apps/orgs with separate backend teams), "Data Access Layer" (recommended for new projects: server-only, authorization checks, returns DTOs), "Component-level data access" (prototypes). "We recommend choosing one data fetching approach and avoiding mixing them." — [Data security guide](https://nextjs.org/docs/app/guides/data-security)
- Next calling an external API from a Server Component forwards the auth token manually via cookies/headers (docs example uses `fetch` with a `Cookie` header). — [Data security guide](https://nextjs.org/docs/app/guides/data-security)
- `proxy.ts` and `route.ts` "have a lot of power" and merit extra audit attention. — [Data security guide](https://nextjs.org/docs/app/guides/data-security)
- With Cache Components, `cookies()`/`headers()` and DB reads are request-time and need Suspense; `'use cache'` functions cannot read request data directly (general model; see Q1 citation). — [cacheComponents docs](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- better-auth is at 1.7.23 on npm, and `@supabase/supabase-js` 2.119.0 (candidate auth libraries; not evaluated in this research). — [npm: better-auth](https://registry.npmjs.org/better-auth), [npm: @supabase/supabase-js](https://registry.npmjs.org/@supabase/supabase-js)

### Inferences
- If `server-admin` is a pure UI that calls `server-app`'s REST API from the browser, you need: CORS headers on Route Handlers (hand-written OPTIONS + `Access-Control-Allow-Origin/Credentials`), cookie `SameSite=None; Secure`, and `credentials: 'include'`. On Vercel default domains this is brittle because (to my knowledge, not verified in this research) `*.vercel.app` is on the Public Suffix List so apps on different `*.vercel.app` subdomains cannot share a parent-domain cookie. With a custom domain (e.g. `app.example.com` + `admin.example.com`, cookie `Domain=.example.com`) it works but adds setup. Server-side calls from `server-admin`'s server code to `server-app` avoid CORS but need a service token and double hops.
- Simplest robust: shared `packages/db` + each app owns its auth/session (admin login separate from user login) and reads the DB directly in its own server code (DAL pattern). This removes CORS, cross-domain cookies and an extra network hop, and two apps connecting to the same Supabase Postgres is trivial. Trade-off: business rules (e.g. User CRUD validation) must live in a shared package (e.g. `packages/db` or `packages/core`) so they are not duplicated.
- Suggested minimum scope for the student deliverable: `server-app` = user-facing UI (landing with Organizer/Joiner choice, organizer dashboard) + Route Handlers `app/api/users` (REST CRUD) if the assignment text says "backend module"; `server-admin` = admin pages using Server Actions + shared DAL for User management. If the rubric demands that the admin be a *client* of the backend, use server-to-server `fetch` from admin Server Components to `server-app` `/api/*` with a shared secret header - no CORS needed because the browser never talks cross-origin.
- Authorization: whichever route is chosen, role checks (admin vs organizer vs joiner) belong in the DAL/Route Handler, not only in `proxy.ts`, per Next's security guidance.

### Gaps
- No primary source found on cross-domain cookie behavior for Vercel default domains (`*.vercel.app` and the Public Suffix List); flagged as unverified background knowledge.
- No evaluation of which auth library (Supabase Auth vs Better Auth vs Auth.js) fits; outside this scope.
- Next.js docs on CORS for Route Handlers were not fetched this session.

## 4. Tailwind 4 + shadcn/ui in a monorepo (CLI, components.json, shared ui package, pitfalls)

### Takeaway
The shadcn CLI (now v4.x) has first-class monorepo support: `shadcn init --monorepo` scaffolds a Turborepo with `apps/web` and `packages/ui`, each workspace needs its own `components.json`, shared components are imported from `@workspace/ui/...`, and for Tailwind v4 the `tailwind.config` field is left empty. For two apps, a shared `packages/ui` is the shadcn-recommended layout, but a lighter option is to run `shadcn init` separately in each app (duplicated components) - fine for a student project.

### Cited Findings
- `npx shadcn@latest init --monorepo` (flag documented on `init`; `-t next` selects Next.js template) "creates `web` and `ui` workspaces with Turborepo"; templates: Next.js, Vite, TanStack Start, React Router, Astro. Run `add` from the app directory (e.g. `apps/web`): UI components go to `packages/ui`, app-specific blocks (e.g. a login form) go in the app, and import paths are rewritten; shared code is imported from `@workspace/ui`. — [shadcn monorepo docs](https://ui.shadcn.com/docs/monorepo)
- Each workspace needs its own `components.json` with aliases so the CLI knows where to write files and how to import; `style`, `iconLibrary` and `baseColor` must match across the files; with Tailwind v4 leave `tailwind.config` empty. You can use `package.json#imports` (`#...`) for package-local aliases; the shared package must export any path another workspace references; shared imports still need explicit aliases in `components.json`. — [shadcn monorepo docs](https://ui.shadcn.com/docs/monorepo)
- CLI options (`init`): `-t/--template next|vite|start|react-router|laravel|astro`, `-b/--base base|radix|aria`, `-p/--preset`, `-d/--defaults` (= `--template=next --preset=nova`), `-y`, `-f`, `-c/--cwd`, `-n/--name`, `--css-variables`, `--monorepo/--no-monorepo`, `--rtl`, `--pointer`, `--reinstall`. `add`: `-y`, `-o/--overwrite`, `-c/--cwd`, `-a/--all`, `-p/--path`, `--dry-run`, `--diff`, `--view`. `create` is an alias for `init`. — [shadcn CLI docs](https://ui.shadcn.com/docs/cli)
- Next.js install page: `pnpm dlx shadcn@latest init -t next` (add `--monorepo` for a monorepo); or create the app with `pnpm create next-app@latest` using defaults (Tailwind, App Router, `@/*` alias) then `pnpm dlx shadcn@latest init`; add components with `pnpm dlx shadcn@latest add button`. A shadcn/create web builder generates a `--preset` code. — [shadcn Next.js install](https://ui.shadcn.com/docs/installation/next)
- Tailwind v4 specifics: `@theme inline`, `:root`/`.dark` outside `@layer base`, `tw-animate-css` replaces deprecated `tailwindcss-animate` (`@import "tw-animate-css";` in globals.css), `forwardRef` removed for React 19 (`React.ComponentProps` + `data-slot`), `toast` deprecated in favor of `sonner`, default style is `new-york`. — [shadcn Tailwind v4 docs](https://ui.shadcn.com/docs/tailwind-v4)
- The CLI docs do not state what `--base` values mean in terms of Radix/Base UI beyond the listed `base|radix|aria`; the fetch tool itself flagged "verify against your CLI version". — [shadcn CLI docs](https://ui.shadcn.com/docs/cli)

### Inferences
- Tailwind v4 uses CSS-first config, so there is no `tailwind.config.js`; classes in `packages/ui` are only generated if the app's CSS scans that package (Tailwind v4 auto-detects sources but ignores `node_modules`/gitignored paths and can miss symlinked workspace packages, so an explicit `@source "../../packages/ui/src"` line in each app's `globals.css` is the standard fix - the shadcn monorepo template handles this, but I did not read the generated CSS). Treat as likely pitfall number one: "components from packages/ui render unstyled".
- Next 16 + Turbopack with a workspace package that ships TypeScript source: use `transpilePackages: ['@workspace/ui']` (or the template's equivalent) - standard Next behavior, not re-verified for 16.4.
- Two-dev simplicity ranking: (1) single `packages/ui` via `shadcn init --monorepo` (cleanest, matches docs, brings Turborepo); (2) separate `shadcn init` per app (no shared package, duplicated `components/ui`, zero workspace plumbing); choose (2) if time is short, (1) if the repo will outlive the course.
- An app-level `components.json` per app plus a `packages/ui/components.json` is required in option (1); if the CLI is run in `apps/server-admin` it needs both files present or it fails to resolve the shared alias.

### Gaps
- I could not read the generated monorepo template (its `globals.css` `@source` lines, `transpilePackages`, `package.json#exports`), so the pitfall list above is partly inferred.
- Radix vs Base UI choice for `--base` was not clarified by a primary source; shadcn docs page mentions base/radix/aria only.
- The shadcn monorepo page's template name for workspaces ("web" and "ui") suggests `apps/web` + `packages/ui`; renaming to `server-app`/`server-admin` was not tested (should be fine, but package `name` fields and imports must be edited consistently).

## 5. Vercel specifics: env vars, Supabase pooler/prepared statements, region, Hobby limits

### Takeaway
Use Supabase's shared pooler in transaction mode (port 6543) from Vercel, with postgres.js/Drizzle `prepare: false`, a module-scope client, small pool size (1), and `ssl: require`; use the direct/session connection (5432) only for `drizzle-kit` migrations. Set the Vercel Function region to match the Supabase region (default for new Vercel projects is `iad1`/Washington D.C.; Hobby allows a single region). Hobby limits are generous for a student app but include a hard personal/non-commercial and no-GitHub-org constraint.

### Cited Findings
- Supabase connection methods: Direct connection port 5432 `db.[REF].supabase.co` (IPv6; IPv4 requires add-on) - for persistent backends/migrations; Shared pooler session mode 5432 and transaction mode 6543 on `aws-[INDEX]-[REGION].pooler.supabase.com` (IPv4 on all plans); Dedicated pooler (Pro+) 6543. Recommendation: "Use the shared pooler in transaction mode on port 6543" for serverless, create the client once at module scope, set pool size to 1, disable prepared statements, SSL `require`. — [Supabase: Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- Pooler string format: `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@[POOLER-HOST]:5432/postgres` (use 6543 for transaction mode); copy the exact pooler host from the dashboard Connect dialog (cannot be derived from region); percent-encode special characters in the password. Transaction mode lacks session state (SET, advisory locks, LISTEN/NOTIFY, temp tables), long-lived cursors and pipelining; "Postgres.js and Drizzle: `prepare: false`". — [Supabase: Connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres)
- Drizzle's Supabase page: use `drizzle-orm/postgres-js` with `postgres(process.env.DATABASE_URL, { prepare: false })` then `drizzle({ client })`; pooler for serverless, direct connection for long-running servers; install lines in the docs reference `drizzle-orm@rc` / `drizzle-kit@rc` (1.0 RC track) while npm `latest` is still 0.45.4 / 0.31.11. — [Drizzle: Connect Supabase](https://orm.drizzle.team/docs/connect-supabase), [npm: drizzle-orm](https://registry.npmjs.org/drizzle-orm)
- Vercel Functions default region for all new projects is `iad1` (Washington, D.C.); set via dashboard Settings -> Functions, `vercel.json` `"regions": ["fra1"]`, or CLI `--regions`. Hobby: a single function region; Pro: up to 5 (a deploy with more regions than allowed fails before build). Choose a region close to the database. — [Vercel: function regions](https://vercel.com/docs/functions/configuring-functions/region)
- Vercel Functions run on Fluid compute (default for new projects). Hobby: max duration 300 s (default and max), 2 GB / 1 vCPU. — [Vercel limits](https://vercel.com/docs/limits)
- Hobby included monthly usage: 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer, 1M CDN requests, 1M function invocations, 4 CPU-hrs Active CPU, 360 GB-hrs provisioned memory, 5K image transformations; runtime logs retained 1 hour; web analytics 50K events; Hobby deployments paused when free-tier usage is exceeded (no on-demand overage); 100 deployments/day and 100 builds/hour; 2 vCPU/8 GB build. — [Hobby plan docs](https://vercel.com/docs/plans/hobby), [Vercel limits](https://vercel.com/docs/limits), [Account plans](https://vercel.com/docs/plans)
- Next.js env vars: server-only by default; `NEXT_PUBLIC_` prefix exposes to browser; only the DAL should read `process.env`; `server-only` package prevents client import of DB modules. — [Data security guide](https://nextjs.org/docs/app/guides/data-security)
- Env var gotcha with Turborepo strict mode: add Vercel-injected vars such as `VERCEL_RELATED_PROJECTS` to `turbo.json`. — [Vercel: Using Monorepos](https://vercel.com/docs/monorepos)

### Inferences
- Env var plan: create `DATABASE_URL` (pooler, 6543, used at runtime by both apps) and `DIRECT_URL` (5432, only for `drizzle-kit migrate/push` run locally or in CI) separately; add `DATABASE_URL` to each Vercel project (Settings -> Environment Variables; separate Production/Preview values - Preview should point at a separate Supabase project or branch to avoid polluting prod data). Each app is a separate Vercel project, so env vars must be entered twice (or use `vercel env` CLI); no shared env file exists across projects.
- Migrations: do not run `drizzle-kit migrate` from the Vercel build on the pooler (transaction mode); run it from a dev machine with `DIRECT_URL`/session mode. The direct connection is IPv6-only unless the add-on is purchased, so local machines or CI without IPv6 should use the *session-mode pooler* (5432 on the pooler host) for migrations. (Derived from the connection table above.)
- Region: if the Supabase project is in e.g. Frankfurt (`eu-central-1`), set both Vercel projects' region to `fra1` via `vercel.json`/dashboard; leaving `iad1` adds a transatlantic round-trip per query (an N-query page multiplies it). Create the Supabase project in the same continent as the Vercel region and as the team.
- Pool size 1 + module-scope client per Supabase guidance matters because Fluid compute reuses instances for concurrent requests; keep the drizzle client in a singleton module in `packages/db`. A dev-mode hot-reload leak guard (`globalThis` caching) is common practice but not cited here.
- Hobby is sufficient for this app's traffic; the practical blockers are policy (no org repos, personal/non-commercial) rather than quotas.

### Gaps
- Exact current Supabase free-tier limits (connection counts, project pausing after inactivity) were not researched - relevant for demo day; check the Supabase pricing/limits page.
- Supabase's own "Vercel integration" (auto-syncing env vars to Vercel) was not researched.
- Whether the Drizzle 1.0 RC (`drizzle-orm@rc`) is advisable vs 0.45.x `latest` for a student project was not resolved; docs now point at `@rc`, npm `latest` is 0.45.4. API differences (e.g. relational query v2, `drizzle({ client })` form) mean examples online may not match the version pinned - pick one and pin it.

## 6. Recommended folder tree and exact scaffold commands

### Takeaway
Recommended: a pnpm workspace with two Next.js apps (`apps/server-app`, `apps/server-admin`) and two shared packages (`packages/db`, and `packages/ui` if you adopt shadcn's monorepo layout), deployed as two Vercel projects pointing at those directories. Turborepo optional. The commands below are from official docs but the combined sequence was not executed in this session.

### Cited Findings
- Commands documented officially: `pnpm create next-app [name] [options]` (flags in Q1); `pnpm dlx shadcn@latest init -t next --monorepo`; `pnpm dlx shadcn@latest add <component>` run from the app dir; `pnpm dlx create-turbo@latest`; `vercel link --repo`; Vercel `installCommand` with `pnpm install --filter <pkg>...`. — [create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app), [shadcn Next install](https://ui.shadcn.com/docs/installation/next), [Turborepo install](https://turborepo.dev/docs/getting-started/installation), [Vercel monorepos](https://vercel.com/docs/monorepos)
- Vercel requires unique package `name`s, a workspace definition (`pnpm-workspace.yaml`) and explicit inter-package dependencies for auto-skip builds. — [Vercel monorepos](https://vercel.com/docs/monorepos)
- Next 16 scaffold produces: `app/`, `next.config.ts`, `tsconfig.json` with `@/*` alias, `AGENTS.md`, ESLint flat config, Tailwind 4 (`@import "tailwindcss"` CSS-first), App Router. (Recommended defaults listed in create-next-app docs.) — [create-next-app](https://nextjs.org/docs/app/api-reference/cli/create-next-app)

### Inferences
Recommended tree (simple option, shadcn shared UI package; drop `packages/ui` and run `shadcn init` per app if preferred):

```
tripshare/                      # repo root (personal GitHub account if on Vercel Hobby)
  package.json                  # private, scripts: dev:app, dev:admin, db:generate, db:migrate
  pnpm-workspace.yaml           # packages: ["apps/*", "packages/*"]
  .npmrc / .gitignore / .env.example
  apps/
    server-app/                 # backend module + public UI (Next 16)
      app/
        (marketing)/page.tsx    # landing: Organizer / Joiner choice
        (organizer)/dashboard/  # organizer dashboard
        api/users/route.ts      # REST CRUD (if required) -> uses @tripshare/db
      proxy.ts                  # optional route guard (NOT middleware.ts)
      components.json  next.config.ts  vercel.json (regions)
    server-admin/               # admin web (Next 16)
      app/(admin)/users/        # user list + create/edit/delete (Server Actions)
      proxy.ts  components.json  next.config.ts  vercel.json
  packages/
    db/                         # @tripshare/db
      src/schema/users.ts       # Drizzle schema (User entity)
      src/client.ts             # postgres(url,{prepare:false,max:1}) + drizzle()
      src/queries/users.ts      # shared DAL (server-only)
      drizzle.config.ts  drizzle/ (migrations)
    ui/                         # @workspace/ui (shadcn shared components) - optional
      components.json  src/components/  src/styles/globals.css
```

Exact scaffold sequence (pnpm):
```bash
mkdir tripshare && cd tripshare && git init && corepack enable
printf 'packages:\n  - "apps/*"\n  - "packages/*"\n' > pnpm-workspace.yaml
pnpm init   # then set "private": true
mkdir apps packages
# apps (answer the prompts; "recommended defaults" = TS, ESLint, Tailwind, App Router, Cache Components, AGENTS.md)
pnpm create next-app apps/server-app --use-pnpm
pnpm create next-app apps/server-admin --use-pnpm
# shared DB package
mkdir -p packages/db/src && cd packages/db && pnpm init   # name "@tripshare/db"
pnpm add drizzle-orm postgres && pnpm add -D drizzle-kit typescript
cd ../..
# apps depend on it
pnpm --filter server-app add @tripshare/db@workspace:*
pnpm --filter server-admin add @tripshare/db@workspace:*
# shadcn: per app (simplest)
cd apps/server-app   && pnpm dlx shadcn@latest init -t next && cd ../..
cd apps/server-admin && pnpm dlx shadcn@latest init -t next && cd ../..
# OR the shadcn-recommended monorepo template (brings Turborepo, apps/web + packages/ui):
#   pnpm dlx shadcn@latest init -t next --monorepo
```
Vercel setup: create two Vercel projects from the same repo with Root Directory `apps/server-app` and `apps/server-admin` (Framework preset Next.js auto-detected); leave "Skip deployment" on; optionally set Install Command `pnpm install --filter server-app...` per project; set `DATABASE_URL` (pooler 6543) in each; set function region next to Supabase in each `vercel.json` (`{"regions":["<code>"]}`).

Notes / flags on over-engineering:
- Not needed for this project: Turborepo remote caching, Changesets/versioning, separate `packages/config` for tsconfig/eslint (copy small configs instead), micro-frontends, Vercel Services, Cache Components tuning, React Compiler, Edge runtime.
- Needed: `packages/db` (the only genuinely shared code), explicit `name`s, per-app env vars, `prepare:false`, region alignment.

### Gaps
- The scaffold sequence has not been run end to end; `workspace:*` linking, Next/Turbopack transpilation of the TypeScript source in `packages/db` (needs `transpilePackages: ['@tripshare/db']` unless the package is pre-built or exports TS via `exports` and Next handles it) and the generated lockfile behavior with `pnpm create next-app` inside a workspace (it may try to init its own git repo/lockfile - use `--disable-git`) should be verified on first run.
- Which shadcn `--base`/preset values are current defaults was not confirmed beyond the CLI doc (default preset "nova").
- Whether the shadcn monorepo template lays out `apps/web` + `packages/ui` exactly as I describe is partly inferred from its summary ("web and ui workspaces with Turborepo").

## Source-handling note
During research one fetched page (Supabase docs, via the summarizing fetch tool) returned an embedded instruction asking the agent to file a feedback report; it was ignored as it was not part of the task. Several Vercel doc pages also contain generic "feedback"/"search from your terminal" boilerplate, also ignored.
