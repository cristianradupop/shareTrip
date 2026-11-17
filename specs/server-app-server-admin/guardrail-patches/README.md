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
