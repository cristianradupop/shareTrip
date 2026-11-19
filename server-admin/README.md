# server-admin

The web UI of TripTogether: landing, login and signup, organizer, joiner, admin, with the public trip feed on the landing page (Next.js 16, React 19, Tailwind 4, shadcn/ui on Base UI). It has no database access and no secrets. All data comes from `server-app` over HTTP.

## Run it

From the repo root: `pnpm dev` starts this app on http://localhost:3000 and `server-app` on http://localhost:3001.

Local config: `server-admin/.env.local` needs only `SERVER_APP_URL` (default `http://localhost:3001`, see `.env.example`). On Vercel the variable is required and the build fails without it, because rewrites are compiled into the build.

## How it calls server-app

- Browser: client components call `/api/*` on this origin through `clientFetch` (`src/lib/client-api.ts`). `next.config.ts` rewrites `/api/:path*` to `${SERVER_APP_URL}/api/:path*`, so the browser sees one origin and the auth cookie stays first-party.
- Server Components: `apiFetch` / `apiGet` (`src/lib/api.ts`, server-only) call `SERVER_APP_URL` directly and forward the request `cookie` header.
- `src/lib/session.ts`: `getSession`, `requireUser`, `requireAdmin` only redirect. They are not a security boundary; every `server-app` endpoint checks the session and role itself.
- Types and validators come from `server-app/shared`; ESLint blocks any other import from `server-app`.

## Join requests

On the landing feed, `JoinAction` (`src/components/trips/join-action.tsx`) sends a join request (logged-out visitors are sent to login with `next`), and lets the joiner withdraw it or leave the trip; `src/lib/join-action.ts` decides what the button shows. Organizers decide on requests from "Requests (n)" on each trip card (`trip-requests-dialog.tsx`), and the organizer nav shows the number of pending requests on "My Trips". Signup and the profile page collect a gender (male or female), which trips limited to one gender check.

## Layout

`src/app/` zones: `(main)`, `(auth)`, `(organizer)`, `(joiner)`, `admin` (the public trip feed is on the landing page, `(main)`). `src/components/` UI (`ui/` is shadcn). `src/proxy.ts` redirects when there is no session cookie.
