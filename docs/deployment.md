# Deployment

`.github/workflows/deploy.yml` runs when a PR is merged into `staging` or `main`.

```
merge to staging ─► CI ─► migrate wrench-staging ─► railway up (staging) ─► health check
merge to main    ─► CI ─► ⏸ Caleb approves ─► migrate wrench-prod ─► railway up (production) ─► health check
```

## Where configuration lives

| What | Where | Notes |
|---|---|---|
| `SUPABASE_DB_URL` | GitHub Environment secret (`staging`, `Production`) | Session-pooler connection string for that environment's database. Used only to apply migrations. |
| `RAILWAY_TOKEN` | GitHub Environment secret | Railway *project token* scoped to one Railway environment. |
| `APP_URL` | GitHub Environment variable | Public URL, used for the health check and shown on the deployment. |
| `RAILWAY_SERVICE` | GitHub Environment variable | Railway service name: `web2` (staging), `web` (production). |
| `SUPABASE_PROJECT_REF` | GitHub Environment variable | Expected project; the deploy refuses a `SUPABASE_DB_URL` for any other project. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Railway service variables (per environment) | Needed at build time; Railway injects them into the build. |

Nothing is stored as a repository-level secret, so PR workflows cannot read any of it.
The Railway service has **no GitHub repo connected**, so Railway never deploys on its own. Every deploy goes
through this workflow and, for production, through your approval.

## Approving a production release

1. Merge the `staging → main` PR. Its diff shows any new files under `supabase/migrations/`; those are
   exactly what will run on production, and they already ran on staging.
2. Open **Actions → Deploy** for that run. It shows **Waiting for review** on *Deploy production*.
3. Check that the staging deploy for the same commits succeeded and staging works.
4. Click **Review deployments → Production → Approve and deploy**.
5. The log shows **Pending migrations (dry run)** first, then applies them, deploys and runs the health check.

## Rolling back

- **App:** Railway → project `WrenchAi` → `production` → `web` (staging: `web2`) → **Deployments** → previous good
  deployment → **Redeploy**. Then fix forward through the normal branch flow.
- **Database:** never reset. Write a new migration that reverses the change and ship it through the
  normal flow. Before a risky production migration, take a manual backup first:
  `pnpm exec supabase db dump --remote="<prod session pooler url>" -f backup.sql` (keep it out of the repo).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Missing in the ... GitHub Environment" | A secret or variable was not added to that environment (names are case-sensitive). |
| `db push` cannot connect | Use the **Session pooler** string (GitHub runners have no IPv6); password with special characters must be URL-encoded. |
| `railway up` unauthorized | Token belongs to a different Railway environment or was revoked. |
| Health check fails, build passed | Missing `NEXT_PUBLIC_*` variables in Railway, or the app crashed on start: check Railway logs. |
