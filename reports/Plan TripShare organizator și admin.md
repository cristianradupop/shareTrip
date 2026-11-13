# Livrează TripShare în doi: plan simplu și solid

**Recomandarea este un monorepo pnpm cu două aplicații Next.js 16 (`server-app` pentru landing, signup/login și Organizer; `server-admin` doar pentru administrarea utilizatorilor) și un pachet comun `packages/db`.** Stack-ul ales: Next.js 16.4.6 + React 19 + Tailwind 4 + shadcn/ui, Drizzle ORM **0.45.4 stabil (pin exact, nu 1.0 RC)**, Postgres pe Supabase prin pooler (port 6543, `prepare: false`), **Better Auth** cu pluginurile `admin` și `username` (rol `user`/`admin` pe utilizator; Organizer/Joiner este o relație per excursie, nu un rol de autentificare), poze în Supabase Storage, formulare cu Zod + React Hook Form. Dev A construiește fundația, autentificarea și pagina de administrare a utilizatorilor; Dev B construiește landing-ul, signup/login, dashboard-ul Organizer și formularul „Trip details". Schema (`trips`, `trip_members`, `chats`, `messages`) este gândită astfel încât partea Joiner să adauge doar cod, nu migrații de refactorizare. Cele mai mari riscuri sunt organizaționale, nu tehnice: **Vercel Hobby nu permite repo-uri din organizații GitHub** și nu are funcții de colaborare ([Vercel limits](https://vercel.com/docs/limits)), proiectul gratuit Supabase se **pune pe pauză după ~7 zile de activitate redusă** ([Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing)), iar sensul cuvântului „modul" (două aplicații deployabile separat sau doar două foldere) trebuie confirmat cu instructorul. Notele cercetate nu conțin PDF-ul sau mockup-urile în sine, așa că cerințele de mai jos vin din rezumatul din brief, iar fiecare loc unde notele marchează o lacună sau un lucru netestat este semnalat explicit.

## 1. Un stack unic, cu cinci incertitudini tranșate

Alegerile de mai jos sunt cele mai simple opțiuni care acoperă cerințele; coloana „Incertitudine" spune ce nu s-a putut verifica.

| Decizie | Alegere | De ce | Incertitudine / ce verificați |
|---|---|---|---|
| Framework | Next.js **16.4.6**, React 19.3, Node >= 20.9 ([npm next](https://registry.npmjs.org/next/16.4.6)) | Versiunea stabilă curentă; cerută de instructor | Patch-urile de securitate apar lunar ([Next.js blog](https://nextjs.org/blog)); actualizați `next` periodic |
| Cache Components | **Dezactivat** în ambele aplicații | De la 16.4 `create-next-app` îl activează implicit, iar ghidul oficial avertizează că poate produce erori de build pentru date necache-uite din afara `<Suspense>` ([Upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)); un CRUD de admin câștigă puțin din el | Notele nu au găsit un flag documentat `--no-cache-components`, doar negarea generică `--no-*`. După scaffold, verificați `next.config.ts` și eliminați `cacheComponents` dacă apare. Dacă îl păstrați, fiecare citire din DB/`cookies()` trebuie învelită în `<Suspense>` |
| TypeScript | Versiunea instalată de `create-next-app`, **fără upgrade manual** | `typescript` `latest` pe npm este 7.0.2, dar Next documentează doar minimul 5.1 | Compatibilitatea Next 16.4 + TS 7 **nu a fost verificată**; nu faceți bump orbește |
| ORM | **Drizzle 0.45.4 / drizzle-kit 0.31.11**, versiuni pinuite exact | `latest` pe npm este stabil; 1.0 este la `rc.5` (21 oct. 2026), iar pagina de release-uri arată doar pre-release-uri ([Drizzle releases](https://orm.drizzle.team/docs/latest-releases)). Ghidul Drizzle pentru Supabase instalează totuși `@rc` ([Drizzle + Supabase](https://orm.drizzle.team/docs/get-started/supabase-new)) | Exemplele de pe internet pot urma API-ul 1.0 (Relational Queries v2) și nu se potrivesc cu 0.45; folosiți interogările clasice `db.select()`. Better Auth 1.7.23 acceptă ambele linii ([npm better-auth](https://registry.npmjs.org/better-auth/1.7.23)), deci puteți migra ulterior |
| Autentificare | **Better Auth 1.7.23** + `@better-auth/drizzle-adapter` + pluginurile `admin` și `username` | Singura opțiune care oferă login cu username, câmp `role`, API de administrare utilizatori (create/list/setRole/ban/remove) și scrie tabelele prin Drizzle, deci `user` stă în același Postgres cu `trips`, cu chei străine reale ([Admin plugin](https://www.better-auth.com/docs/plugins/admin), [Username plugin](https://www.better-auth.com/docs/plugins/username)). Alternativele pierd: Auth.js v5 este încă beta și a fost absorbit de echipa Better Auth ([Auth.js](https://authjs.dev/getting-started/migrating-to-v5)); Clerk Hobby nu include reguli de parolă personalizate și ban ([Clerk pricing](https://clerk.com/pricing)) | Runner-up: Supabase Auth, cel mai puțin cod, dar username-ul și rolurile devin incomode; **notele nu au citit documentația Supabase Auth**, deci această comparație e din cunoștințe generale. Better Auth a intrat în Vercel (iulie 2026), ceea ce reduce riscul de abandon, dar postarea nu spune nimic despre licență ([Better Auth joins Vercel](https://better-auth.com/blog/better-auth-joins-vercel)) |
| „Modul" | **Două aplicații Next.js separate** (`server-app`, `server-admin`) în același repo | Satisface literal cerința instructorului și izolează sesiunile admin/utilizator | Dacă instructorul acceptă un singur proiect, **fallback-ul cel mai simplu** este o singură aplicație cu route groups `(admin)`, `(user)` și `api/`: un deploy, o sesiune, fără duplicare. Întrebarea 1 din secțiunea 9 decide |

Despre fluxul de date între cele două aplicații, recomandarea este cea mai simplă: **ambele importă `packages/db` și citesc direct din Postgres** pe partea de server, fiecare cu propria autentificare. Documentația Next recomandă pentru proiecte noi un strat de acces la date (DAL) doar pe server, cu verificări de autorizare și DTO-uri minime, și sfătuiește să nu amestecați abordările ([Data security guide](https://nextjs.org/docs/app/guides/data-security)). Un REST între cele două aplicații ar aduce CORS, cookie-uri `SameSite=None` și un hop suplimentar, iar Server Actions sunt blocate din construcție pentru origini diferite ([serverActions config](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions)). Dacă instructorul insistă ca `server-admin` să fie „client al backend-ului", varianta de rezervă din note este apelul server-la-server (fetch din Server Components către `/api/*` din `server-app`, cu un secret partajat), care evită CORS-ul. Comportamentul cookie-urilor între domenii `*.vercel.app` diferite **nu a fost verificat** în note.

Patru reguli Next 16 care afectează direct un CRUD: `await` pe `params`, `searchParams`, `cookies()` și `headers()`; fișierul de gardă se numește `proxy.ts` (funcția exportată `proxy`), nu `middleware.ts`; `next lint` a dispărut, deci rulați `eslint .`; Turbopack este bundler-ul implicit ([Next.js 16 blog](https://nextjs.org/blog/next-16), [Upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)).

## 2. Repo-ul: pnpm workspace fără Turborepo

Structura propusă ține doar codul genuin comun (baza de date) într-un pachet și lasă restul în aplicații. Vercel sare automat peste proiectele neafectate dacă repo-ul folosește workspaces npm/yarn/pnpm, deci Turborepo nu este necesar ([Vercel monorepos](https://vercel.com/docs/monorepos)).

```
tripshare/                       # repo pe contul personal al owner-ului Vercel (vezi secțiunea 7)
  package.json                   # private; scripturi: dev:app, dev:admin, db:*
  pnpm-workspace.yaml            # packages: ["apps/*", "packages/*"]
  .env.example  .gitignore
  apps/
    server-app/                  # landing, signup/login, Organizer, feed
      app/(marketing)/page.tsx   # landing: Organizer / Joiner
      app/(auth)/...             # signup, login
      app/(organizer)/dashboard/ # dashboard + trip nou
      app/api/auth/[...all]/     # handler Better Auth
      proxy.ts  next.config.ts  vercel.json  components.json
    server-admin/                # doar admin
      app/(admin)/users/         # listă, creare, editare, ban, ștergere
      app/login/
      proxy.ts  next.config.ts  vercel.json  components.json
  packages/
    db/                          # @tripshare/db
      src/schema/ (auth-schema.ts, trips.ts, ...)
      src/client.ts  src/auth.ts  src/queries/
      drizzle.config.ts  drizzle/   # migrații SQL commit-uite
  scripts/seed-admin.ts  scripts/seed-demo.ts
  e2e/                           # Playwright
```

Comenzile de scaffold vin din documentația oficială, dar **secvența completă nu a fost rulată de nimeni**; toate sunt marcate [neexecutat] și trebuie validate la prima rulare:

```bash
mkdir tripshare && cd tripshare && git init && corepack enable          # [neexecutat]
printf 'packages:\n  - "apps/*"\n  - "packages/*"\n' > pnpm-workspace.yaml
pnpm init   # apoi "private": true
mkdir apps packages
pnpm create next-app apps/server-app   --use-pnpm --disable-git          # [neexecutat]
pnpm create next-app apps/server-admin --use-pnpm --disable-git          # [neexecutat]
mkdir -p packages/db/src && cd packages/db && pnpm init                  # name: "@tripshare/db"
pnpm add -E drizzle-orm@0.45.4 postgres && pnpm add -D -E drizzle-kit@0.31.11 tsx typescript
cd ../..
pnpm --filter server-app   add @tripshare/db@workspace:*
pnpm --filter server-admin add @tripshare/db@workspace:*
# shadcn, separat în fiecare aplicație (varianta cea mai simplă)
(cd apps/server-app   && pnpm dlx shadcn@latest init -t next)           # [neexecutat]
(cd apps/server-admin && pnpm dlx shadcn@latest init -t next)           # [neexecutat]
# dependențe formulare/auth în server-app (și auth în server-admin)
pnpm --filter server-app add better-auth @better-auth/drizzle-adapter zod react-hook-form @hookform/resolvers sonner
```

Trei capcane de verificat la prima rulare, toate semnalate ca lacune în note: `packages/db` livrează cod TypeScript, deci probabil are nevoie de `transpilePackages: ['@tripshare/db']` în `next.config.ts` al ambelor aplicații; `create-next-app` în interiorul unui workspace poate crea propriul git sau lockfile (de aici `--disable-git`); iar compatibilitatea `@hookform/resolvers` 7.0.6 cu Zod 4.6 nu a fost confirmată, deci faceți un smoke test imediat după instalare.

La interfață, pentru doi studenți, rularea `shadcn init` separat în fiecare aplicație (componente duplicate, zero plomberie de workspace) este mai simplă decât `init --monorepo`, care aduce Turborepo și un pachet `packages/ui`; documentația shadcn recomandă a doua variantă, dar o spune ca pe o opțiune pentru proiecte care vor dura ([shadcn monorepo](https://ui.shadcn.com/docs/monorepo)). Avantaj colateral: fără `packages/ui` dispare riscul ca componentele partajate să apară nestilate în Tailwind 4 (necesită un `@source` explicit, inferență din note). Scripturile din rădăcină: `db:generate`, `db:migrate`, `db:studio`, `db:seed`, `db:check`, `lint` (`eslint .`), `typecheck` (`tsc --noEmit`), `test`, `e2e`. Ce **nu** aveți nevoie: Turborepo cu remote caching, Changesets, pachet separat de configurări tsconfig/eslint (copiați fișiere mici), React Compiler, runtime Edge, Vercel Services ([notele Next/Vercel](https://vercel.com/docs/monorepos)).

## 3. Schema bazei de date: Organizer acum, Joiner fără refactorizări

Tabelele de autentificare (`user`, `session`, `account`, `verification`) le generează Better Auth cu `npx auth@latest generate`, apoi `drizzle-kit generate` și `drizzle-kit migrate` ([Installation](https://www.better-auth.com/docs/installation), [Drizzle adapter](https://www.better-auth.com/docs/adapters/drizzle)). Păstrați ID-urile text implicite ale Better Auth pentru `user.id`, iar cheile străine ca `text` (risc minim; opțiunea `generateId: "uuid"` nu a fost verificată în note). Comanda `npx auth migrate` este doar pentru adaptorul Kysely, nu pentru Drizzle.

| Tabel | Câmpuri principale | Observații |
|---|---|---|
| `user` (Better Auth + `additionalFields`) | `username`, `role` (`user`/`admin`, din plugin), `banned`, plus **`firstName`, `lastName`, `phone`, `address`, `birthDate` (date)** | `name` este obligatoriu în Better Auth: completați-l din prenume + nume (inferență). `role` cu `input: false`, ca să nu poată fi setat din signup ([Database concepts](https://www.better-auth.com/docs/concepts/database)) |
| `user_photos` | `id`, `userId` (cascade), `url`, `isPrimary`, `createdAt` | PDF cere cel puțin o poză JPG/PNG; tabel separat permite mai multe |
| `trips` | `id` uuid, `organizerId` → user, `destinationCity`, `destinationCountry`, `departureDate`, `returnDate` (nullable = o singură zi), `maxTravelers`, `gender` (enum), `budgetEstimate` numeric(10,2) + `currency`, `transport` (enum), `theme` (descriere), `status` (enum), `createdAt` | Toate câmpurile din „Trip details" sunt obligatorii în formular. Index-uri: `(departureDate, id)`, `(lower(destinationCity), departureDate, id)`, `createdAt`, `organizerId` ([Drizzle indexes](https://orm.drizzle.team/docs/indexes-constraints)) |
| `trip_members` | PK `(tripId, userId)`, `joinedAt` | Aici apare relația Joiner; Organizer-ul este `trips.organizerId` |
| `chats` (mai târziu) | `id`, `tripId` **unique** (un chat de grup per excursie) | Creat la prima aderare sau la crearea excursiei |
| `messages` (mai târziu) | `id`, `chatId`, `senderId`, `body`, `createdAt`, index `(chatId, createdAt)` | Membrii chatului se derivă din `trip_members`, deci nu e nevoie de `chat_members` |

Schema completă propusă de cercetători (cu enum-uri `trip_gender`, `transport_method`, `trip_status`) este un punct de pornire, nu cod verificat: sintaxa exactă a coloanelor trebuie confirmată față de versiunea Drizzle instalată, iar `check()` pentru `returnDate >= departureDate` nu a fost verificat în documentație. Nimic din ea nu blochează Joiner-ul: aderarea înseamnă un `INSERT` în `trip_members` plus, la prima aderare, un rând în `chats`, într-o singură tranzacție care verifică capacitatea cu `SELECT ... FOR UPDATE` pe rândul excursiei (inferență din note). Locurile rămase se pot calcula ca `maxTravelers - count(trip_members)`.

Trei nepotriviri între PDF/mockup și schemă, de tranșat în echipă (secțiunea 9): câmpul „gender" din PDF este interpretat în note ca preferință de grup (`male`/`female`/`mixed`), interpretare neconfirmată; mockup-ul arată statusuri **Active / Draft / Planning**, dar fluxul din PDF nu are ciorne (butonul „Create" e inactiv până la completare, iar „Close" aruncă datele), așa că enum-ul `open/full/cancelled/completed` e suficient, cu etichete mapate în UI; iar cardul „Avg. Rating" din mockup nu are nicio sursă în schemă, deci îl omiteți sau afișați un placeholder explicit.

## 4. Autentificare și roluri: un rol global, relația Organizer/Joiner pe excursie

**Există un singur rol de autentificare, `user` sau `admin`, pe tabelul `user`.** „Organizer" și „Joiner" nu sunt roluri: un utilizator este Organizer al excursiilor în care `trips.organizerId` este el și Joiner al celor în care apare în `trip_members`. Butoanele „Continue as Organizer / Continue as Joiner" de pe landing sunt doar navigare către dashboardul corespunzător (inferență; nu salvați nimic în DB). Adminii se creează exclusiv prin seed, niciodată prin signup public.

**Garda în trei straturi** (apărare în adâncime): `proxy.ts` face doar redirect ieftin pe baza existenței cookie-ului, pentru că documentația Better Auth spune explicit că `getSessionCookie` „nu este o graniță de securitate"; un helper `requireAdmin()` apelează `auth.api.getSession({ headers: await headers() })` și verifică `role === "admin"` în **fiecare** Server Component, route handler și Server Action din `server-admin`; iar niciodată nu vă bazați pe verificări de rol din client ([Better Auth Next.js](https://www.better-auth.com/docs/integrations/next)). Server Actions pot fi apelate prin POST direct, deci verificarea trebuie repetată în fiecare acțiune, inclusiv proprietatea asupra resursei (doar Organizer-ul își editează/anulează excursia) ([Data security guide](https://nextjs.org/docs/app/guides/data-security)). Un utilizator obișnuit care se loghează pe URL-ul de admin primește 403, nu un dashboard. Pluginul `nextCookies()` trebuie pus ultimul în lista de pluginuri pentru ca Server Actions să poată seta cookie-uri.

**Sesiuni separate:** dați lui `server-admin` propriul `advanced.cookiePrefix`, propriul `BETTER_AUTH_SECRET` (minim 32 de caractere, `openssl rand -base64 32`) și propriul `BETTER_AUTH_URL`; nu activați `crossSubDomainCookies`, pentru că nu vreți single sign-on ([Cookies](https://www.better-auth.com/docs/concepts/cookies)). Configurația Better Auth vine ca o funcție-fabrică în `packages/db/src/auth.ts` (propunere de design, netestată) apelată cu parametrii fiecărei aplicații.

**Parole și limitări:** scrypt implicit (nu scrieți hashing propriu), lungime 8-128; impuneți în Zod o politică mai strictă (10-12 caractere, caractere mixte). Rate limiting-ul din Better Auth este activ doar în producție, iar stocarea implicită în memorie „nu este potrivită pentru serverless"; folosiți `rateLimit: { storage: "database" }` ([Rate limit](https://www.better-auth.com/docs/concepts/rate-limit)). **Test obligatoriu:** trimiteți `role: "admin"` în corpul signup-ului și asertați că rămâne `user` (notele marchează asta ca punct de verificat, nu ca fapt confirmat).

**Primul admin:** `auth.api.createUser` cere o sesiune de admin, deci nu poate crea primul admin. Scriptul `scripts/seed-admin.ts` (rulat cu `tsx`) apelează `auth.api.signUpEmail`, apoi `db.update(user).set({ role: "admin", emailVerified: true })`, citește parola din variabilă de mediu (niciodată hardcodată) și este idempotent (sare dacă emailul există). Alternativa: listați id-ul în `adminUserIds`. Ambele sunt propuneri din inferențe, neprobate.

**Poze la signup:** Supabase Storage cu bucket public restricționat la `image/jpeg` și `image/png`, plafon de ~2 MB, `serverActions.bodySizeLimit: '3mb'` (implicit 1 MB; limita Vercel e 4,5 MB) ([serverActions](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions), [Vercel Functions](https://vercel.com/docs/functions/limitations)). Serverul revalidează tipul prin magic bytes (JPEG `FF D8 FF`, PNG `89 50 4E 47`), generează numele fișierului (`<userId>/<uuid>.jpg`), respinge SVG și șterge obiectul dacă insertul în `user_photos` eșuează. Secvența: validare → `signUpEmail` → upload → insert `user_photos`. Cheia secretă Supabase rămâne doar pe server. Vercel Blob e o alternativă echivalentă și mai simplă la chei, dar cu blocare de 30 de zile la depășirea limitei Hobby ([Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing)).

**Securitate DB:** Drizzle se conectează ca rol cu `bypassrls`, deci autorizarea e în codul vostru. Totuși, activați `ENABLE ROW LEVEL SECURITY` pe **toate** tabelele (inclusiv `user`, `session`, `account`, care conțin hash-uri și token-uri), fără politici pentru `anon`, ca endpoint-ul REST public Supabase să nu servească niciodată aceste date ([Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)). Selectați explicit coloanele în feed: fără telefon, adresă, dată de naștere sau email; arătați doar prenumele și poza Organizer-ului.

## 5. Plan de lucru pentru doi dezvoltatori

Durata totală depinde de termenul instructorului, pe care notele nu îl menționează; planul folosește dimensiuni relative (S/M/L) și etape, nu date calendaristice. Principiul: o fază scurtă făcută **împreună** (nimeni nu poate lucra util fără schemă și autentificare), apoi împărțire pe zone cu proprietar clar.

**Faza 0, împreună (S).** Confirmați întrebările 1-3 din secțiunea 9; creați repo-ul pe contul potrivit pentru Vercel; scaffold-ul din secțiunea 2; două proiecte Supabase (vezi secțiunea 6); `.env.example`; reguli Git: `main` protejat, PR obligatoriu, CI verde, ramuri scurte `feat/<zonă>-<ceva>`, squash-merge, review încrucișat, fără ramură `develop` ([notele de workflow](https://orm.drizzle.team/docs/migrations)). Pentru migrații: `git pull --rebase main` înainte de `generate`, `drizzle-kit check` local și în CI, iar dacă două ramuri au generat migrații, al doilea care face merge își regenerează migrația ([drizzle-kit check](https://orm.drizzle.team/docs/drizzle-kit-check)). Împărțiți schema pe fișiere de domeniu (`auth-schema.ts`, `trips.ts`) ca să reduceți conflictele.

| Etapă | Dev A: fundație + Admin | Dev B: Main + Organizer |
|---|---|---|
| **1. Schelet mergând (M)** | `packages/db` (client postgres.js cu `max: 1`, `prepare: false`, `ssl: "require"`), configurare Better Auth, tabele auth + `trips`/`trip_members`, prima migrație, `seed-admin.ts`, RLS pe toate tabelele, CI (lint + typecheck + `drizzle-kit check`), deploy gol al ambelor proiecte pe Vercel | Pagina de **landing** completă: hero, nav (Home, About, Contact, toggle dark/light, „Login / Sign Up"), titlul „Explore. Plan. Travel Together.", cele două carduri; design tokens Tailwind (portocaliu/teal); layout responsive |
| **2. Conturi (M)** | Server Action de signup + upload poze (validare server, rollback), rate limit în DB, test de injecție `role` | Formular **Create account** (RHF + Zod, `mode: "onChange"`, buton dezactivat până la validitate, câmpuri invalide roșii, mesaj „Your account has been successfully created") și pagina de login |
| **3. Administrare utilizatori (L)** | **`server-admin`:** login admin, `requireAdmin()`, pagină `/users` cu listă (căutare, sortare, paginare), creare, editare, schimbare rol, ban/unban, ștergere cu confirmare; 403 pentru non-admin | Layout Organizer: sidebar (My Trips, Create Trip, Messages dezactivat „în curând", My Profile, Settings, Logout), „Welcome back, {prenume}" |
| **4. Organizer (L)** | Query-uri DAL pentru trips (listă proprii, statistici: număr excursii, total participanți), verificări de proprietate | Dashboard (card statistici, „Your Trips" cu imagine/date/joined/status, „View all"), **pop-up „Trip details"** cu cele opt câmpuri obligatorii, „Create" inactiv + roșu, „Close" cu avertismentul „Are you sure you want to cancel this trip? Your data for this trip will be lost" și revenire la home |
| **5. Feed + finisare (M)** | Index-uri verificate cu `EXPLAIN ANALYZE` pe date seed, keep-alive Supabase, env vars pe Vercel, `vercel.json` regiune | Feed pe home (vezi mai jos), stări de eroare, responsive pe telefon |
| **6. Calitate + demo (S)** | 3-5 teste Playwright, `drizzle-seed`/seed demo (~20 excursii), `pg_dump` de siguranță | Verificarea acceptării pe deploy-ul de producție, textele exacte din PDF, pregătirea demo-ului |

**Feed-ul.** Cerințele PDF privind feed-ul (filtru pe oraș, sortare crescător/descrescător după data plecării, Refresh sub 3 secunde cu cele mai noi primele, la eroare de server vechiul feed rămâne și apare „Sorry, but for the moment we don't have information for you") țin de zona Joiner, dar o variantă doar-citire e ieftină și necesară ca Organizer-ul să-și vadă excursia publicată. Recomandare: includeți-l în etapa 5 (decizie de confirmat, întrebarea 7), fără butonul „Join". Implementarea sugerată de cercetători: paginare keyset pe `(departureDate, id)` cu limită ~20, filtru oraș prin comparație exactă pe `lower(destinationCity)` (un `ILIKE 'prefix%'` nu folosește indexul), dropdown din orașe distincte, iar Refresh ca `GET /api/trips?since=<createdAt maxim văzut>` (valoare luată de la server, nu de la ceasul clientului), cu prepend al noilor rânduri. Pentru obiectivul de 3 secunde nu există măsurători reale în note; cifra e raționată, iar benchmark-ul pe ~10.000 de rânduri seed cu `EXPLAIN ANALYZE` este modul de confirmare. Principalii factori de latență sunt regiunea (secțiunea 7), proiectul Supabase pus pe pauză și N+1 (folosiți un singur join cu organizatorul).

**Criterii de acceptare, luate din scenariile PDF:**

| Zonă | Criteriu |
|---|---|
| Signup | Buton inactiv până când toate câmpurile (username, parolă, prenume, nume, email, telefon, adresă, dată naștere, ≥1 poză JPG/PNG) sunt valide; câmpurile invalide roșii; la succes exact „Your account has been successfully created" |
| Trip nou | Pop-up „Trip details" cu oraș, țară, dată/perioadă, nr. călători, gender, buget estimat, transport, temă/descriere; „Create" inactiv + roșu până la completare; „Close" afișează avertismentul exact și duce la home fără a salva |
| Dashboard | Excursia creată apare în „Your Trips" cu statusul corect; statisticile se calculează din DB |
| Feed | Filtru oraș, sortare asc/desc, Refresh < 3 s cu rezultate noi primele, la eroare feed vechi + mesajul exact |
| Admin | Doar `admin` intră; non-admin primește 403; CRUD complet pe utilizatori; ban revocă sesiunile |
| Securitate | `role` nu poate fi setat din signup; feed-ul nu expune telefon/adresă/dată naștere |

**Definiția lui „gata" (pentru orice task):** PR revizuit de celălalt dezvoltator, CI verde (lint, typecheck, `drizzle-kit check`), migrația commit-uită și aplicată pe baza de dev, funcționează pe deploy-ul preview, criteriile de acceptare bifate, validare server-side prezentă, fără secrete în Git. **Repere:** M1 = ambele aplicații deployate și conectate la DB, loginul admin funcționează; M2 = signup + admin users CRUD; M3 = Organizer creează o excursie și o vede în dashboard; M4 = feed, teste, date demo, demo repetat pe producție.

**Teste minime** (Playwright, doar Chromium în CI; Vitest pentru schema Zod): home se încarcă; signup respectă regulile de validare; Organizer creează o excursie; admin se loghează, iar non-admin primește 403; `role` nu se poate injecta. Notele avertizează că Vitest nu suportă componente Server asincrone, deci acelea se testează end-to-end ([Next.js Vitest](https://nextjs.org/docs/app/guides/testing/vitest), [Playwright](https://nextjs.org/docs/app/guides/testing/playwright)).

## 6. Interfață grafică pentru Postgres: Drizzle Studio plus dashboardul Supabase

**Instrumentul zilnic este Drizzle Studio** (`drizzle-kit studio`, expus ca script `db:studio`): gratuit, vine cu drizzle-kit, citește `drizzle.config.ts` și pornește local la `127.0.0.1:4983`; este conceput doar pentru uz local, nu este open source, iar Safari/Brave pot cere `mkcert` ([Drizzle Studio](https://orm.drizzle.team/drizzle-studio/overview), [drizzle-kit studio](https://orm.drizzle.team/docs/drizzle-kit-studio); necesitatea `mkcert` în versiunile curente nu a fost verificată). Complementul: Table Editor și SQL Editor din dashboardul Supabase, fără configurare ([Supabase database](https://supabase.com/docs/guides/database/overview)). Dacă vreți un client desktop pe macOS, **Beekeeper Studio Community** (gratuit, ușor, potrivit pentru studenți, dar fără import/export și cu maximum 2 filtre per tabel) sau **DBeaver Community** (complet gratuit, mai greu) ([Beekeeper pricing](https://www.beekeeperstudio.io/pricing), [DBeaver](https://dbeaver.io/download/)). TablePlus și Postico sunt plătite după perioada de probă. Un stack Docker cu pgAdmin/Adminer duplică ce aveți deja și adaugă Docker ca cerință; săriți-l.

**Detalii de conectare pentru orice client:** host-ul pooler copiat din dialogul „Connect" al proiectului (nu se poate deduce din regiune), **port 5432 (session mode)**, utilizator `postgres.[PROJECT-REF]`, bază `postgres`, SSL `require`; caracterele speciale din parolă se codifică procentual în URL. Conexiunea directă (`db.[REF].supabase.co`) este **doar IPv6** pe planul gratuit, deci eșuează pe multe rețele IPv4 ([Supabase connecting](https://supabase.com/docs/guides/database/connecting-to-postgres)). Folosiți session mode și pentru Studio și pentru `drizzle-kit migrate`, iar transaction mode (6543) doar pentru aplicația rulată pe Vercel.

**Baza de date pe medii.** Notele recomandă un Postgres local per dezvoltator (prin `supabase start` cu Docker/OrbStack, port 54322, Studio la `localhost:54323`, sau un container Postgres simplu) plus un proiect Supabase comun ca staging; credențialele implicite locale `postgres:postgres` sunt din cunoștințe generale, **neconfirmate** în paginile citite. Pentru doi studenți, varianta mai simplă și suficientă este: **două proiecte Supabase gratuite** (planul permite două; cele pe pauză nu se numără) ([Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase)), unul „dev" folosit de amândoi (și de preview-urile Vercel) și unul „prod" pentru deploy-ul final și demo. Aceasta este o abatere conștientă de la recomandarea notelor, justificată de lipsa Docker-ului; riscul ei sunt ciocnirile de schemă, pe care le evită disciplina de migrații din secțiunea 5 (`generate` + `migrate` cu SQL commit-uit; `push` doar pe un Postgres local aruncabil). Dacă apar ciocniri, treceți la Postgres local per dezvoltator. Nu amestecați două sisteme de migrații: Drizzle e singurul, Supabase e doar Postgres + Studio ([notele de workflow](https://supabase.com/docs/guides/local-development/overview)). Seed: un `seed-demo.ts` determinist (`drizzle-seed` cu număr fix) plus câteva rânduri scrise de mână, pentru demo identic pe ambele mașini ([drizzle-seed](https://orm.drizzle.team/docs/seed-overview)).

## 7. Deploy pe Vercel: două proiecte, un risc de plan, regiune potrivită

**Mecanica:** pentru fiecare aplicație creați un proiect Vercel din același repo, cu Root Directory `apps/server-app`, respectiv `apps/server-admin`; Hobby permite până la 25 de proiecte conectate la același repo ([Vercel limits](https://vercel.com/docs/limits)), iar „Skip deployment" evită build-urile pentru proiectele neafectate ([Vercel monorepos](https://vercel.com/docs/monorepos)). Opțional, în `vercel.json` al fiecărei aplicații, `installCommand` cu `pnpm install --filter server-app...` (exemplul oficial folosește `apps/web/vercel.json`; dacă funcționează cu Root Directory setat nu a fost testat). Fiecare push pe o ramură produce un deploy preview, iar merge în `main` produce producția ([Vercel Git](https://vercel.com/docs/git)). **Nu rulați `drizzle-kit migrate` din build-ul Vercel;** rulați-l de pe o mașină locală sau din CI, cu conexiunea session mode.

**Riscurile planului Hobby, de rezolvat în Faza 0 și testate la M1:** (1) Hobby nu poate conecta proiecte la repo-uri deținute de o **organizație GitHub**, deci repo-ul trebuie să stea pe un cont personal ([Vercel limits](https://vercel.com/docs/limits)); (2) pe Hobby, autorul commit-ului trebuie să fie owner-ul echipei Hobby, altfel deploy-ul este blocat și se recomandă trecerea la Pro, iar documentația precizează că regula nu se aplică colaboratorilor de pe conturi Git personale ([Vercel Git](https://vercel.com/docs/git)); formularea este ambiguă, așa că **testați devreme** dacă un commit al celui de-al doilea dezvoltator, pe repo-ul personal al owner-ului, se deployează; (3) funcțiile de colaborare în echipă lipsesc din Hobby, iar locurile Pro costă 20 USD/utilizator/lună ([Hobby plan](https://vercel.com/docs/plans/hobby)); (4) Hobby este descris ca plan personal, necomercial, dar textul exact al termenilor **nu a fost citit** (doar fragmente secundare), deci confirmați că un proiect școlar e acoperit; (5) 100 de deploy-uri pe zi. Opțiuni dacă testul eșuează: owner-ul Vercel face merge-ul/commit-ul final, repo public sau echipă Pro. Pentru un proiect de curs, Hobby cu repo personal este de obicei suficient.

**Variabile de mediu** (fiecare proiect Vercel le primește separat; nu există fișier comun între proiecte, deci le introduceți de două ori sau cu `vercel env`):

| Variabilă | Unde | Valoare |
|---|---|---|
| `DATABASE_URL` | ambele proiecte (Production = proiect Supabase „prod", Preview = „dev") | pooler **transaction, port 6543** |
| `DIRECT_URL` (sau `DATABASE_URL_MIGRATE`) | doar local/CI, pentru drizzle-kit și Studio | pooler **session, port 5432** |
| `BETTER_AUTH_SECRET` | ambele, **valori diferite** | min. 32 caractere |
| `BETTER_AUTH_URL` | fiecare cu propriul URL | URL-ul aplicației |
| `SUPABASE_URL`, cheia secretă Supabase | doar `server-app` (upload poze) | fără prefix `NEXT_PUBLIC_` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | doar local, pentru seed | niciodată în Git |

Nicio variabilă cu date sensibile nu primește prefixul `NEXT_PUBLIC_`; modulele de DB importă `server-only` ([Data security guide](https://nextjs.org/docs/app/guides/data-security)). URL-urile preview se schimbă la fiecare deploy; verificați cum se comportă `BETTER_AUTH_URL`/`trustedOrigins` pe preview (notele nu acoperă asta, e punct de testat la M1).

**Regiunea decide latența.** Funcțiile Vercel rulează implicit în `iad1` (Washington), iar Hobby permite o singură regiune; setați-o în `vercel.json` (`{"regions": ["fra1"]}` dacă baza e la Frankfurt) și creați proiectele Supabase în aceeași zonă ca regiunea Vercel și ca utilizatorii ([Vercel regions](https://vercel.com/docs/functions/configuring-functions/region)). O regiune nepotrivită adaugă un drum transatlantic pentru fiecare interogare, direct în bugetul de 3 secunde al Refresh-ului. În codul de conexiune: client creat o dată la nivel de modul, `max: 1`, `prepare: false`, `ssl: "require"` ([Supabase connecting](https://supabase.com/docs/guides/database/connecting-to-postgres)); în dev, cache pe `globalThis` ca să evitați scurgeri de conexiuni la hot reload (practică comună, necitată).

**Pauza Supabase.** Proiectele gratuite cu activitate redusă timp de o săptămână sunt puse pe pauză; „câteva cereri pe zi" sunt de obicei suficiente ([Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing)). Programați un ping (GitHub Actions sau Vercel cron) către o rută ieftină care atinge efectiv baza de date, cel puțin o dată la câteva zile, și redeschideți manual proiectul înainte de demo. Fereastra de restaurare e inconsistentă între surse (1 an în pagina oficială citită, 90 de zile în alte rezultate), așa că nu vă bazați pe ea; păstrați un `pg_dump`.

## 8. Îmbunătățiri: ce este obligatoriu și ce este de lux

PDF-ul vorbește despre aplicație mobilă iOS/Android, iar instructorul cere aplicație web; compromisul practic este **UI responsive pe telefon** (Next 16 cere browsere Chrome/Edge/Firefox 111+ și Safari 16.4+) și, opțional, un manifest PWA ([Upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)).

| Obligatoriu (must) | De lux (nice to have) |
|---|---|
| Hashing prin Better Auth (scrypt), politică Zod mai strictă decât minimul bibliotecii, mesaj generic la login greșit | Verificare email (aduce dependență de un furnizor de email; sărită dacă instructorul nu o cere) |
| Validare **și pe server** cu aceeași schemă Zod; verificări de proprietate (IDOR) în fiecare acțiune | PWA: manifest + icon pentru „Add to home screen" |
| RLS activat pe toate tabelele, fără politici `anon`; fără chei secrete în browser | Paginare keyset cu „Load more" în loc de simplu `LIMIT` (necesară doar când feed-ul crește) |
| Upload poze: tip + mărime + magic bytes pe server, nume generat, SVG respins, rollback la eșec | Refresh incremental `since=` (fără el, un reload simplu al primei pagini îndeplinește cerința la scară de curs) |
| Rate limit pe login cu stocare în DB (memoria nu ține pe serverless) | Jurnal de audit pentru accesul adminilor la date personale |
| GDPR minimal: telefon, adresă, dată de naștere și poză sunt date personale; colectați doar ce cere specificația, paragraf de confidențialitate, `deleteUser` activat cu cascade pe FK, proiect Supabase în UE dacă utilizatorii sunt în UE | Export de date personale pentru utilizator |
| Feed-ul nu expune date sensibile; coloane selectate explicit | Ban cu motiv și expirare în UI-ul de admin |
| Index-uri pe căile de filtrare/sortare + date seed pentru a demonstra < 3 s | Benchmark pe 10.000 de rânduri cu `EXPLAIN ANALYZE` |
| Keep-alive Supabase și `pg_dump` înainte de demo | Toggle dark/light (apare în mockup; ieftin cu variabilele shadcn) |
| Versiuni pinuite exact; `.env.example`; ESLint flat config + `tsc --noEmit` în CI | Prettier + `eslint-config-prettier`, lint-staged (CI acoperă esențialul; săriți Husky/Biome) |
| 3-5 teste Playwright (secțiunea 5) | Realtime Supabase pentru chat mai târziu (200 conexiuni de vârf pe plan gratuit) sau simplu polling pe `(chatId, createdAt)` |

Lucruri de **evitat ca exces de inginerie** pentru doi studenți: Turborepo cu cache remote, Changesets, `packages/ui` partajat, React Compiler, runtime Edge, Vercel Services, micro-frontends, Supabase Branching (plan și preț neconfirmate în note), două sisteme de migrații în paralel (Drizzle + Supabase), un stack Docker cu pgAdmin, un strat REST între cele două aplicații fără o cerință explicită.

## 9. Întrebări deschise pentru echipă

1. **Ce înseamnă „modul" pentru instructor:** două aplicații deployate separat sau două foldere/zone într-un proiect? Răspunsul alege între arhitectura din acest plan și fallback-ul cu route groups. Dacă `server-app` trebuie să fie un „backend" apelat de `server-admin`, ajunge apelul server-la-server cu secret partajat, nu un REST public?
2. **Cine deține repo-ul GitHub și contul Vercel Hobby?** Trebuie un cont personal (nu organizație), iar al doilea dezvoltator trebuie să poată declanșa deploy-uri; cine plătește Pro dacă testul de la M1 eșuează?
3. **Termenul și criteriile de notare:** care sunt datele de predare și ce se evaluează (cod, deploy, demo)? Notele nu conțin termenul, deci dimensiunile din plan sunt relative.
4. **Ce ar trebui să însemne „gender" în „Trip details"**: preferința de gen a grupului (male/female/mixed, cum a presupus cercetarea) sau genul Organizer-ului?
5. **Statusurile din mockup (Active/Draft/Planning) față de PDF** (fără ciorne): le păstrăm doar ca etichete mapate pe `open/full/cancelled/completed` sau adăugăm cu adevărat ciorne? Și ce facem cu „Avg. Rating" (nu există rating în cerințe)?
6. **Verificare email necesară?** Dacă da, trebuie ales un furnizor de email; dacă nu, o omitem.
7. **Feed-ul și paginile Messages/Settings/My Profile:** intră feed-ul doar-citire în această sesiune (recomandat) sau rămâne integral la partea Joiner? Câte dintre elementele de sidebar cer implementare acum?
8. **Poze de profil:** limita de ~2 MB și bucket-ul public sunt acceptabile din punct de vedere al confidențialității sau fotografiile trebuie să fie private?
9. **Regiunea:** unde sunt utilizatorii și demo-ul (pentru alegerea regiunii Supabase/Vercel)?
10. **Dark/light și „About/Contact":** sunt pagini reale sau doar ancore pe landing?

## Concluzie

Planul reduce riscul prin două mișcări, nu prin tehnologie: se amână tot ce ține de Joiner dar se fixează de acum structura (`trip_members`, `chats` unic per excursie), iar deciziile ireversibile sau externe (sensul „modulului", proprietarul repo-ului pentru Vercel Hobby, regiunea) se iau în Faza 0, înainte de prima linie de cod. Alegerea Better Auth cu un singur rol global și relația Organizer/Joiner pe excursie simplifică și autentificarea, și schema, și administrarea, pentru că „administrarea utilizatorilor" devine o pagină peste API-ul pluginului `admin` și peste același tabel `user`, nu o sincronizare cu un serviciu extern.

Ce rămâne neverificat în note, și deci de validat în primele ore: secvența de scaffold nerulată, compatibilitatea TypeScript 7 cu Next 16.4, `@hookform/resolvers` cu Zod 4.6, comportamentul real al deploy-urilor Hobby cu doi committeri, `trustedOrigins` pe URL-urile preview și latența reală sub 3 secunde. Fiecare are un punct de test pe drumul spre M1, așa că echipa află devreme dacă o presupunere cade, nu în ziua demo-ului.
