# Testing strategy

Test what would hurt users or block the demo. Skip tests that only restate the implementation.

| Layer | Tool | Location | What it covers |
|---|---|---|---|
| Unit | Vitest | `src/**/*.test.ts` | Zod schemas (AI responses, video index, inputs), timestamp parsing and formatting, video-status rules, quota logic. |
| Component | Vitest + Testing Library | `src/**/*.test.tsx` | Chat panel states (analyzed / not analyzed / error), bookmark list, vehicle picker. |
| Database | pgTAP via `supabase test db` | `supabase/tests/*.test.sql` | Every RLS policy (allowed and denied), triggers, constraints. |
| End-to-end | Playwright | `e2e/*.spec.ts` | Golden paths on desktop and mobile Chrome: sign up → add vehicle → start mission → ask at a timestamp (AI provider stubbed) → bookmark → complete; log maintenance. |
| AI evaluation | script | `scripts/experiments/` | Real-model runs on chosen videos, scored by a human, including honesty probes. Not in CI (costs money, non-deterministic). |

## Rules

- **Every RLS policy has a pgTAP test** for both "can" and "cannot".
- **AI responses are schema-validated**, and tests cover provider failures and the not-analyzed path. CI never calls the real AI provider.
- E2E runs against the **production build** (`pnpm build && pnpm test:e2e`), like CI.
- E2E tests that need data use a local database seeded with clearly fake fixture content
  (see `ai-rules.md` §7). They never touch staging or production.
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
