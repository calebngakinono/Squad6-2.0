# Wrench AI — engineering instructions

Wrench AI is an AI copilot for DIY car repairs: watch a YouTube repair tutorial in the Wrench workspace,
pause at a confusing moment, and ask. The assistant answers from the analyzed video, the timestamp and the
user's vehicle. Around it: a digital garage, repair missions with bookmarks and notes, and a light
maintenance log. It is a capstone due 2026-11-23: the video-aware answer is the core; everything else
supports it.

@AGENTS.md

## Read before major work

- `docs/architecture.md` — system design and module boundaries
- `docs/database-schema.md` — tables, RLS rules, migration rules
- `docs/ai-rules.md` — **mandatory** for anything the AI says or any repair information shown
- `docs/mvp-plan.md` — current scope and priorities
- `docs/testing-strategy.md` — what to test where
- `docs/workflow.md` — branches, PRs, releases, migrations in deploys
- `docs/deployment.md` — deploy pipeline, approving production, rollback

## Stack

Next.js 16 App Router (React 19, Cache Components on), TypeScript strict, Tailwind v4, shadcn/ui (base-nova),
Supabase (Auth, Postgres, RLS), Zod 4, Vitest, Playwright, pnpm, GitHub Actions, Railway.
Backend is Server Actions and Route Handlers inside the Next.js app. Do not add a separate backend,
worker or microservice without a demonstrated need, agreed with Caleb first.

Next.js 16 differs from older versions (e.g. `middleware.ts` is now `proxy.ts`). Check
`node_modules/next/dist/docs/` before using a Next.js API you have not verified in this version.

## Commands

```bash
pnpm dev                 # app on http://localhost:3000
pnpm lint                # ESLint, zero warnings allowed
pnpm typecheck           # next typegen + tsc
pnpm test                # Vitest unit/integration
pnpm build && pnpm test:e2e   # Playwright against the production build
pnpm db:start            # local Supabase in Docker (ports 253xx)
pnpm db:test             # pgTAP tests in supabase/tests
pnpm db:lint             # schema lint
pnpm db:reset            # rebuild LOCAL database from migrations
pnpm db:types            # regenerate src/lib/supabase/database.types.ts
pnpm exec supabase migration new <name>   # new migration file
```

## Hard rules

1. **Database changes only through migrations** in `supabase/migrations/`. Never edit an applied migration;
   add a new one. Never change schema through the Supabase dashboard.
2. **Never run destructive commands against remote databases.** No `supabase db reset --linked`,
   no `DROP`/`TRUNCATE` scripts against staging or production. `db reset` is for local only.
   Migrations must be safe to apply to a database that already has user data.
3. **Every table gets RLS enabled in the same migration that creates it**, with policies and a pgTAP test
   in `supabase/tests/` proving owners can and others cannot.
4. **No secrets in the repo.** It is public. Only `.env.example` is committed. `NEXT_PUBLIC_*` values are
   shipped to browsers — never put a secret key in one. The Supabase secret key is server-only.
5. **Never fabricate automotive information.** No invented specs, torque values, part numbers, fluid
   capacities or safety steps — not in seed data, UI copy, tests or AI output. Never let the AI claim to
   have seen a video that was not analyzed. See `docs/ai-rules.md`.
6. **Validate all external input with Zod** at the boundary (Server Actions, Route Handlers, AI tool calls,
   AI provider responses).
7. Do not push to `dev`, `qa`, `staging` or `main` directly, and never merge a PR without Caleb's approval.

## How to work

- Branch from `dev` as `feature/<short-name>`; PR into `dev`. Promotions are PRs `dev→qa→staging→main`
  with merge commits (no squash) — see `docs/workflow.md`.
- Before saying work is done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`,
  plus `pnpm db:test` if the schema changed. Report real results.
- Prefer Server Components; add `"use client"` only for interactivity. Use shadcn/ui components before
  building custom ones. Design for mobile and desktop; the workspace (video and chat side by side) is desktop-first.
- Keep explanations simple: Caleb is returning after a few months away, so explain major technical
  decisions in plain terms.
- Update the relevant doc in `docs/` in the same PR when a decision changes it.
