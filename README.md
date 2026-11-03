# Wrench AI

Vehicle-specific repair lookups and interactive repair guides, with an AI assistant that only answers
from verified information.

## Quick start

Requires Node 24, pnpm and Docker.

```bash
pnpm install
pnpm db:start                 # local Supabase in Docker; prints the local publishable key
cp .env.example .env.local    # paste the PUBLISHABLE_KEY from db:start
pnpm dev                      # http://localhost:3000
```

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e
pnpm db:test
```

## Docs

- [Architecture](docs/architecture.md)
- [Database schema](docs/database-schema.md)
- [Content verification rules](docs/content-verification.md)
- [Testing strategy](docs/testing-strategy.md)
- [MVP plan](docs/mvp-plan.md)
- [Branches, PRs and releases](docs/workflow.md)
- [Engineering instructions for AI assistants](CLAUDE.md)
