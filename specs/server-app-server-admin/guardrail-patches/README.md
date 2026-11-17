# Patch-uri pentru fișierele de guardrail (PR 1)

Agenții nu au voie să editeze `.claude/hooks`, `.claude/agents`, `.githooks` sau `.github/workflows`. Patch-urile de mai jos se aplică manual, de către om, după mutarea aplicației în `server-admin/`.

- `pr1-stop-check.patch`: `.claude/hooks/stop-check.sh` urmărește noile căi (`server-admin e2e drizzle package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vitest.config.mts playwright.config.ts`), în loc de `src scripts next.config.ts eslint.config.mjs`. În același patch se repară și injecția existentă din `xargs -I{} sh -c 'echo {}; cat "{}"'` (nume ca `(joiner)` o stricau, iar un nume cu `$(...)` ar fi executat cod): acum `xargs -I{} sh -c 'echo "$1"; cat "$1"' _ {}`.
- `pr1-security-reviewer.patch`: `.claude/agents/security-reviewer.md` folosește `server-admin/src/...` în loc de `src/...`.
- `pr1-protect-generated.patch`: doar mesajul din `.claude/hooks/protect-generated.sh` (`server-admin/src/db/schema/*`); comportamentul nu se schimbă.

Nu e nevoie de patch pentru `.githooks/*`, CODEOWNERS și `.github/workflows/*`: nu referă `src/`, `scripts/` sau alte căi mutate (CODEOWNERS are doar `*` și `/.github/`; workflow-urile folosesc `drizzle/**`, `playwright-report/`, `test-results/` și comenzi `pnpm` de la rădăcină).

Aplică toate odată, din rădăcina repo-ului:

```bash
git apply specs/server-app-server-admin/guardrail-patches/pr1-*.patch
```

# Patch-uri PR 2 (server-app / server-admin)

- `pr2-migrate.patch`: `.github/workflows/migrate.yml` filtrează `paths` pe `server-app/drizzle/**`. Pasul `pnpm db:migrate` rămâne neschimbat: scriptul din rădăcină filtrează deja `server-app`.
- `pr2-stop-check.patch`: `.claude/hooks/stop-check.sh` urmărește și `server-app`; intrarea `drizzle` din rădăcină dispare (s-a mutat). Forma sigură de `xargs` rămâne.
- `pr2-protect-generated.patch`: mesajul din `.claude/hooks/protect-generated.sh` trimite la `server-app/src/db/schema/*`.
- `pr2-deploy-smoke.patch`: `.github/workflows/deploy-smoke.yml` nu rula niciodată, pentru că Vercel postează commit statuses, nu GitHub Deployments. Acum rulează pe `status` (succes, commit pe `main`, doar pentru proiectul frontend: context `Vercel` sau care se termină cu ` share-trip`, nu cel al lui server-app), cu `concurrency` pe sha, și verifică `https://share-trip-inky.vercel.app`: `/` 200, `/login` 200, `/admin` 302/307, `/api/health` 200 cu `status: "ok"` și `/api/admin/users` 401 (ambele trec prin rewrite, deci dovedesc și că server-app răspunde).
- `pr2-security-reviewer.patch`: `.claude/agents/security-reviewer.md` folosește noile căi și noua invariantă (fiecare handler din server-app apelează `requireApiUser`/`requireApiAdmin` înainte de a citi body-ul; `requireUser`/`requireAdmin` din server-admin doar redirecționează).

CODEOWNERS și `ci.yml` nu au nevoie de patch.

Aplică-le pe toate, după PR 1, din rădăcina repo-ului:

```bash
git apply specs/server-app-server-admin/guardrail-patches/pr2-*.patch
```
