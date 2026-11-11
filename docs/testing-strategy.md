# Testing strategy

Test what would hurt users, corrupt the standings or block the demo. Skip tests that only restate the
implementation.

| Layer | Tool | Location | What it covers |
|---|---|---|---|
| Unit | Vitest | `**/*.test.ts` | Zod schemas, scoring-rule calculations (table of scenarios: activities, durations, schedules, evidence levels), offline event queue, timezone/season boundaries. |
| Component | Vitest + Testing Library | `**/*.test.tsx` | Web components; mobile components once `apps/mobile` exists. |
| Database | pgTAP via `supabase test db` | `supabase/tests/*.test.sql` | Every RLS policy (allowed and denied), column privileges, every workout state transition (valid and invalid), idempotency, one-active-session rule, no double awards, max-six squads. |
| End-to-end (web) | Playwright | `apps/web/e2e/*.spec.ts` | Marketing site and server endpoints against the production build. |
| API integration (mobile) | Vitest + local Supabase | `apps/mobile/src/**/*.integration.test.ts` | The app's data layer against the real local database (RLS, RPC names, embedded selects). Skipped unless `SQUADS_IT_URL`/`SQUADS_IT_KEY` point at a **local** stack; refuses non-local URLs. |
| On-device | manual checklist, later Maestro | `docs/` | Kill the app mid-workout, airplane mode, permission denied, background GPS, HealthKit matching. |

## Rules

- **Every RLS policy has a pgTAP test** for both "can" and "cannot".
- **Scoring changes come with scenario tests** and a new rule version.
- E2E runs against the **production build** (`pnpm build && pnpm test:e2e`), like CI.
- Test data uses clearly fake fixtures on a local database. Tests never touch staging or production.
- A bug fix starts with a failing test that reproduces it.

## In CI (`.github/workflows/ci.yml`)

Every PR and push to a long-lived branch runs:

1. **Promotion guard**: PRs follow `feature/* → dev → qa → staging → main`
2. **App checks**: lint (zero warnings) → typecheck → unit tests → `pnpm audit --audit-level=high` → build → Playwright
3. **Database checks**: migration guard → disposable local Supabase applies every migration from scratch → pgTAP tests → schema lint
4. **CodeQL**: static security analysis

CI has no access to staging or production secrets.

## Locally before a PR

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
pnpm db:start && pnpm db:test      # when the schema changed
```
