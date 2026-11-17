# Ghid de pornire: TripTogether pe calculatorul tău

Ghid pentru cineva care nu a lucrat încă cu proiectul. Urmează pașii în ordine. Dacă te blochezi, trimite-i lui Cristian mesajul exact de eroare.

Tu lucrezi la zona **Joiner** (vezi `README.md`). Tot ce ține de zona ta se află în `server-admin/src/app/(joiner)/`. Aplicația Next.js stă acum în `server-admin/`; un PR viitor mută codul de backend în `server-app/`.

## 0. Ce îți trebuie înainte

1. **Cont GitHub**, iar Cristian te adaugă ca *collaborator* pe repo (primești un email de invitație, apasă *Accept*).
2. **Git**: verifică în terminal cu `git --version`. Dacă lipsește: https://git-scm.com/downloads
3. **Node 24**: verifică cu `node --version` (trebuie să înceapă cu `v24`). Instalare recomandată prin nvm: https://github.com/nvm-sh/nvm (pe Windows: nvm-windows).
4. **pnpm**: după ce ai Node, rulează `corepack enable`. Verifică cu `pnpm --version`.
5. **Un editor**: VS Code (https://code.visualstudio.com).
6. **Valorile secrete** (`server-admin/.env.local`): le primești de la Cristian pe un canal privat (mesaj direct). **Nu** le pui niciodată pe GitHub, în commit-uri sau în chat-uri de grup.

Configurează o singură dată numele și emailul pentru git (același email ca la contul GitHub):

```bash
git config --global user.name "Numele Tău"
git config --global user.email "emailul-tau@exemplu.com"
```

## 1. Descarcă proiectul

```bash
git clone https://github.com/cristianradupop/shareTrip.git
cd shareTrip
code .          # deschide proiectul în VS Code
```

## 2. Instalează dependențele

```bash
pnpm install
```

Durează câteva minute. Tot acum se activează automat verificările de calitate (git hooks).

## 3. Configurează `server-admin/.env.local`

```bash
cp server-admin/.env.example server-admin/.env.local
```

Deschide `server-admin/.env.local` și completează valorile primite de la Cristian (baza de date, chei Supabase, secretul de autentificare). Folosiți **aceeași bază de date**, deci **nu** rula `db:migrate` sau `db:seed-*`: sunt deja făcute.

`server-admin/.env.local` este ignorat de git, deci nu poate ajunge din greșeală pe GitHub. Verifică totuși că `BETTER_AUTH_URL=http://localhost:3000`.

## 4. Pornește aplicația

```bash
pnpm dev
```

Deschide http://localhost:3000. Te poți loga cu contul demo:
- email: `alex.popescu@demo.test` (sau username `alex`)
- parola: `Demo-Pass-123!`

Oprești serverul cu `Ctrl + C`.

## 5. Cum lucrezi cu git (regula de aur)

> **Nu lucrezi niciodată direct pe `main`.** `main` se schimbă doar printr-un *pull request* (PR) cu verificările verzi.

Fluxul, pe scurt:

```
branch nou -> modifici cod -> commit -> push -> pull request -> verificări verzi -> merge pe GitHub
```

### 5.1 Începe o sarcină nouă (de fiecare dată)

```bash
git switch main
git pull --ff-only                 # ia ultimele schimbări de la ceilalți
git switch -c feat/butonul-join    # branch nou, cu un nume scurt
```

Prefixe de nume: `feat/` (funcționalitate), `fix/` (corecție), `docs/` (documentație), `chore/` (altele).

### 5.2 Lucrează și salvează (commit)

Vezi ce ai schimbat:

```bash
git status
```

Salvează schimbările:

```bash
git add server-admin/src/app/\(joiner\)/ceva.tsx     # sau: git add .  (atenție să nu adaugi fișiere nedorite)
git commit -m "Add join button to feed card"
```

Sfaturi:
- Commit-uri mici și dese, cu mesaj scurt la imperativ, în engleză (ex: `Fix spots left count`).
- La commit rulează automat `pnpm check` (lint, tipuri, teste). Dacă pică, citește eroarea, repar-o și fă commit din nou. **Nu** folosi `--no-verify`.
- Poți rula verificările oricând: `pnpm check`.

### 5.3 Trimite pe GitHub (push)

Prima dată pentru un branch:

```bash
git push -u origin feat/butonul-join
```

Următoarele ori, doar `git push`.

### 5.4 Deschide Pull Request

După push, terminalul afișează un link. Deschide-l (sau intră pe GitHub, apare butonul **Compare & pull request**).
- Baza (*base*) trebuie să fie `main`.
- Completează descrierea. Ar trebui să poți explica ce face schimbarea.
- GitHub pornește automat verificările (`check`, `migrations`, `e2e`). Așteaptă să fie toate verzi.
- Dacă una e roșie: repară pe același branch, fă commit și push. PR-ul se reverifică singur.

### 5.5 Merge

Când totul e verde, apasă **Squash and merge** pe GitHub (nu din terminal). După merge, Vercel publică automat site-ul.

### 5.6 Curăță local după merge

```bash
git switch main
git pull --ff-only
git branch -d feat/butonul-join
```

## 6. Reguli importante

- Editezi doar **zona ta** (`server-admin/src/app/(joiner)/`, plus tabelele tale noi). Fișierele comune (`server-admin/src/db/schema`, `server-admin/src/lib/auth.ts`, `server-admin/src/components/ui`, layout-ul principal) se schimbă doar în PR-uri mici, separate, anunțate lui Cristian.
- Nu face niciodată `git push --force` și nu face commit direct pe `main`.
- Secretele (`.env.local`) nu se pun nicăieri în repo.
- Dacă modifici schema bazei de date (`server-admin/src/db/schema/*`), rulează `pnpm db:generate` și include fișierul SQL nou din `drizzle/` în același PR. Spune-i lui Cristian înainte, deoarece baza de date e comună.
- Pentru funcționalități noi se folosește fluxul `/harness` din Claude Code (vezi `CLAUDE.md`). Pentru corecturi mici, lucrezi direct.

## 7. Comenzi utile

| Comandă | Ce face |
|---|---|
| `pnpm dev` | pornește aplicația local (http://localhost:3000) |
| `pnpm check` | lint + tipuri + teste, înainte de PR |
| `pnpm test:file server-admin/src/lib/format.test.ts` | rulează un singur fișier de teste |
| `git status` | ce fișiere ai modificat |
| `git diff` | ce ai schimbat exact |
| `git log --oneline -10` | ultimele 10 commit-uri |
| `git switch main` | te întorci pe `main` |
| `git pull --ff-only` | iei schimbările noi de pe GitHub |

## 8. Probleme frecvente

- **`pnpm: command not found`**: rulează `corepack enable`, apoi deschide un terminal nou.
- **Versiune Node greșită**: `nvm install 24 && nvm use 24`.
- **Eroare `DATABASE_URL` la pornire**: lipsește sau e greșit `.env.local`. Verifică că fișierul e în `server-admin/`, nu în rădăcina proiectului. Comenzile `pnpm` se rulează tot din rădăcină.
- **`git pull --ff-only` dă eroare**: ai modificări locale necomise sau ești pe alt branch. Fă commit sau întreabă înainte să ștergi ceva.
- **Ai făcut din greșeală commit pe `main`**: nu da push. Scrie-i lui Cristian, se rezolvă simplu dacă nu ai împins nimic.
- **Orice altceva**: copiază mesajul complet de eroare și trimite-l.
