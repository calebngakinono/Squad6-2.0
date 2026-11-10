# Squad Six

Fitness consistency is easier when five people are counting on you. Squad Six puts you in a squad of up to
six, turns every workout into a live session, and keeps an honest, auditable score across a season that runs
from January 1 to December 31.

Status: early development. The mobile app is being built; this repo currently contains the web app,
database and deploy pipeline. See [the MVP plan](docs/mvp-plan.md).

## Quick start (web)

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
- [Data integrity and privacy rules](docs/data-integrity.md)
- [MVP plan](docs/mvp-plan.md)
- [Testing strategy](docs/testing-strategy.md)
- [Branches, PRs and releases](docs/workflow.md)
- [Deployment and rollback](docs/deployment.md)
- [Engineering instructions for AI assistants](CLAUDE.md)
