# Branches, PRs and releases

```
feature/*  ──PR──►  dev  ──PR──►  qa  ──PR──►  staging  ──PR──►  main
 (work)        (integration)  (final check) (deploys to     (deploys to production
                                             staging)         after Caleb approves)
```

## Daily work

```bash
git switch dev && git pull
git switch -c feature/quick-lookup-search
# ...work, commit...
git push -u origin feature/quick-lookup-search
gh pr create --base dev
```

- Feature PRs into `dev` may be squash-merged (one tidy commit per feature).
- CI must be green before merging. Nobody merges without Caleb's approval.

## Promotions

Open a PR from each branch to the next: `dev → qa`, `qa → staging`, `staging → main`.

- Use **"Create a merge commit"** (the only option allowed on `qa`, `staging` and `main`). Squashing
  would rewrite history and make the branches drift apart, causing fake conflicts next time.
- The **Promotion guard** check fails any PR that skips a step (e.g. `dev → main`).

## What protects each branch

GitHub rulesets on `dev`, `qa`, `staging` and `main`: no direct pushes, no force pushes, no deletion,
PR required, review conversations resolved. Required status checks are added once CI is proven green.

## Database migrations in releases

- Every PR: the **migration guard** rejects edits to merged migrations and data-destroying SQL
  (`drop table`, `drop column`, `drop schema`, `truncate`, `delete from`) unless the new file contains
  `-- destructive-ok: <reason>`. Then every migration is applied to a disposable database and tested.
- Merging to `staging` applies new migrations to the staging database, then deploys the app.
- Merging to `main` waits for Caleb's approval in the `Production` GitHub Environment, shows the pending
  migrations, applies them to the production database, then deploys the app.
- Only `supabase db push` (apply new migrations) is used against cloud databases. Never `db reset`.

Details, approval steps and rollback: [deployment.md](deployment.md).
