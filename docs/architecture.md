# Architecture

## Shape

One Next.js app, one Postgres database per environment. No separate backend.

```
Browser ──► Next.js on Railway ──► Supabase (Auth + Postgres with RLS + Storage)
             │  Server Components      (reads)
             │  Server Actions         (writes)
             │  Route Handlers         (health check, AI streaming, webhooks)
             └► LLM provider           (AI assistant, server-side only)
```

| Environment | Branch | Railway | Supabase project |
|---|---|---|---|
| local | any | `pnpm dev` | Docker (`pnpm db:start`) |
| CI | PRs | — | Disposable Docker database |
| staging | `staging` | `staging` env | `wrench-staging` |
| production | `main` | `production` env | `wrench-prod` |

`dev` and `qa` are integration branches that run CI only; they have no hosted environment.

## Security model

- **RLS is the real access control.** The browser and server both use the Supabase *publishable* key with
  the user's session, so Postgres policies decide what each user can see. Code bugs cannot leak other
  users' data if policies are right.
- The Supabase *secret* key bypasses RLS. It is used only in server code for admin tasks (content
  ingestion, migrations in CI) and never in a `NEXT_PUBLIC_*` variable.
- Published, verified repair content is readable by anonymous visitors (Quick Lookup needs no account).
  Drafts and unverified content are visible only to editors.

## Modules and where they live

| Module | Priority | Route(s) | Notes |
|---|---|---|---|
| A. Quick Lookup | 1 | `/`, `/lookup/...` | No login. Quick View and Guided View of the same verified content. |
| C. Repair Studio | 1 | `/repair/[guide]` | Renders schema-driven guide JSON: steps, branches, hotspots, safety gates. |
| B. Onboarding & My Garage | 2 | `/onboarding`, `/garage` | Supabase Auth; profile + vehicles. |
| F. Maintenance tracking | 2 | `/garage/[vehicle]/history` | Records; can be created from a completed repair. |
| D. AI Assistant | 3 | `/assistant`, in-guide help | Answers only from verified content; cites sources; refuses otherwise. |
| G. Analytics & feedback | 3 | — | Consent-based events + post-repair feedback. |
| E. Knowledge Engine | foundation | admin only | Sources, licensing, revisions, verification workflow. Full ingestion is post-MVP. |

## Key design decisions

1. **Guides are data, not pages.** A guide revision is a JSON document validated by a Zod schema
   (`src/features/guides/schema.ts`, added with the Repair Studio). One renderer handles every guide, so
   adding a repair means adding verified content, not code. The same document powers Quick View,
   Guided View and AI grounding.
2. **Revisions are immutable once verified.** Corrections create a new revision. User progress and
   maintenance records point at the exact revision they used.
3. **The AI never authors repair content.** It retrieves verified revisions and their sources, answers
   from them, and says so when it has nothing verified. See `content-verification.md`.
4. **Server-first rendering.** Content pages are Server Components (fast on phones, good SEO);
   interactive pieces (hotspot viewer, step state, checklists) are small client components.

## Code layout

```
src/
  app/                 routes only; thin
  features/<module>/   components, server actions, queries, schemas per module
  components/ui/       shadcn/ui primitives
  lib/                 env, supabase clients, shared utilities
supabase/
  migrations/          the only way schema changes
  tests/               pgTAP tests (RLS, triggers)
e2e/                   Playwright
docs/
```
