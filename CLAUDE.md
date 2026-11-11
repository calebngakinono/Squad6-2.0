# Squad Six — engineering instructions

Squad Six is a mobile-first social fitness accountability app. People join squads of up to six, start and
finish **live workout sessions**, earn server-calculated points, and compete with their squad through annual
seasons (January 1 – December 31). The core is free; Squad Six Pro adds analytics, leadership tools and
achievement history. Target date for the first complete release: **2026-12-09** (see `docs/mvp-plan.md`).

This repo previously held Wrench AI. Its infrastructure (CI, gated deploys, branch flow) was kept on purpose.
Some external names still say "wrench" (Railway URLs, Supabase dashboard names); see `docs/deployment.md`
before renaming anything outside the repo.

@apps/web/AGENTS.md
@apps/mobile/AGENTS.md

## Read before major work

- `docs/architecture.md` — system design, module boundaries, workout session engine
- `docs/database-schema.md` — tables, RLS rules, migration rules
- `docs/data-integrity.md` — **mandatory** for anything that touches points, workouts, metrics or location
- `docs/mvp-plan.md` — scope for 2026-12-09 and what is deliberately deferred
- `docs/scoring-proposal.md` — scoring rules v1, daily rules, challenges (**approved 2026-11-10**; production competitive scoring still needs Caleb's sign-off at release)
- `docs/health-integrations.md` — HealthKit, Health Connect, evidence providers, future watch app
- `docs/testing-strategy.md` — what to test where
- `docs/workflow.md` — branches, PRs, releases, migrations in deploys
- `docs/deployment.md` — deploy pipeline, approving production, rollback

## Stack

| Part | Tech |
|---|---|
| Mobile app (`apps/mobile`) | Expo SDK 58 (React Native, TypeScript, Expo Router), development builds via EAS. Expo Go is not supported (HealthKit, Health Connect, background GPS need native code). |
| Web (`apps/web`) | Next.js 16 App Router (React 19, Cache Components on), Tailwind v4, shadcn/ui. Public marketing site plus server-only endpoints (webhooks, account deletion). |
| Data and auth | Supabase (Auth, Postgres, RLS). Business rules live in Postgres functions. |
| Subscriptions | RevenueCat (not live until store products and sandbox testing are set up). |
| Validation, tests, tooling | Zod 4, Vitest, Playwright, pgTAP, pnpm, GitHub Actions, Railway. |

Do not add a separate backend, worker or microservice without a demonstrated need, agreed with Caleb first.
Do not change frameworks or deployment providers without approval.

Next.js 16 differs from older versions (e.g. `middleware.ts` is now `proxy.ts`). Check
`apps/web/node_modules/next/dist/docs/` before using a Next.js API you have not verified in this version.

## Commands

```bash
pnpm dev                 # web app on http://localhost:3000
pnpm lint                # ESLint in every workspace package, zero warnings allowed
pnpm typecheck           # tsc in every package (web also runs next typegen)
pnpm test                # Vitest in every package
pnpm build && pnpm test:e2e   # Playwright against the production build
pnpm db:start            # local Supabase in Docker (ports 253xx)
pnpm db:test             # pgTAP tests in supabase/tests
pnpm db:lint             # schema lint
pnpm db:reset            # rebuild LOCAL database from migrations
pnpm db:types            # regenerate packages/shared/src/database.types.ts
pnpm scoring:simulate    # print the scoring-rule simulation tables
pnpm --filter @squad-six/web <script>     # run one package's script
pnpm exec supabase migration new <name>   # new migration file
npx skills experimental_install           # restore design skills pinned in skills-lock.json
```

Mobile (from `apps/mobile`; setup in `docs/mobile-setup.md`):

```bash
pnpm start               # Metro for the installed development build
npx expo install <pkg>   # add a dependency at the SDK-compatible version (not pnpm add)
pnpm doctor              # expo-doctor
npx eas-cli@latest build --profile development --platform ios   # new dev build (after native changes)
```

Layout: `apps/web` (Next.js), `apps/mobile` (Expo), `packages/shared` (Zod schemas, DB types; no React or
platform APIs), `supabase/` at the root (the deploy pipeline depends on it). Root scripts run every package,
so CI and Railway (`pnpm build`, `pnpm start` from the root) did not change. The session token is stored in the
OS keychain (`expo-secure-store`), never in plain storage.

## Hard rules

1. **Database changes only through migrations** in `supabase/migrations/`. Never edit an applied migration;
   add a new one. Never change schema through the Supabase dashboard.
2. **Never run destructive commands against remote databases.** No `supabase db reset --linked`,
   no `DROP`/`TRUNCATE` scripts against staging or production. `db reset` is for local only.
   Migrations must be safe to apply to a database that already has user data.
3. **Every table gets RLS enabled in the same migration that creates it**, with policies and a pgTAP test
   in `supabase/tests/` proving owners can and others cannot. Users must never be able to write their own
   points, scores, streaks, roles or verification results — use column-level privileges and Postgres
   functions, not just row-level policies.
4. **No secrets in the repo.** It is public. Only `.env.example` is committed. `NEXT_PUBLIC_*` and
   `EXPO_PUBLIC_*` values are shipped to devices and browsers — never put a secret key in one. The Supabase
   secret key and RevenueCat secret key are server-only.
5. **Never fabricate fitness data.** No invented metrics, calories, heart rates, distances, insights or
   analytics. Every metric records its source and whether it was live, synced, manual or estimated, and the
   UI says so. Demo and onboarding content is clearly labeled as demo. See `docs/data-integrity.md`.
6. **Points are server-authoritative.** The client never calculates awarded points. Every award is a
   ledger entry that can be traced to a session and a scoring-rule version, and cannot be awarded twice.
7. **Precise location is never visible to other users.** Teammates see city at most.
8. **Validate all external input with Zod** at the boundary (Server Actions, Route Handlers, webhooks,
   health-platform data, client payloads to RPCs).
9. Do not push to `dev`, `qa`, `staging` or `main` directly, and never merge a PR without Caleb's approval.
10. No prize campaigns, live purchases or production competitive scoring without Caleb's explicit sign-off.

## How to work

- Branch from `dev` as `feature/<short-name>`; PR into `dev`. Promotions are PRs `dev→qa→staging→main`
  with merge commits (no squash) — see `docs/workflow.md`.
- Before saying work is done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`,
  plus `pnpm db:test` if the schema changed. Report real results. A mocked feature is not a finished feature.
- Mobile UI: design for one-handed phone use first. Use the `impeccable` skill for app UI and the
  `design-taste-frontend` skill for the marketing site. Final visuals come from Figma later, so prefer
  centralized tokens over one-off styling.
- Keep explanations simple: Caleb is returning after a few months away, so explain major technical
  decisions in plain terms.
- Update the relevant doc in `docs/` in the same PR when a decision changes it.
