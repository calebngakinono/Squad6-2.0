# Deployment

`.github/workflows/deploy.yml` runs when a PR is merged into `staging` or `main`.

```
merge to staging ─► CI ─► migrate staging DB ─► railway up (staging) ─► health check
merge to main    ─► CI ─► ⏸ Caleb approves ─► migrate production DB ─► railway up (production) ─► health check
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

## Leftover Wrench AI names outside the repo

The pipeline was built for Wrench AI and kept for Squad Six. These names live in dashboards, not code:

| Name | Where | Safe to rename? |
|---|---|---|
| Railway project `WrenchAi` | Railway dashboard | Yes. Display name only; tokens keep working. |
| Supabase projects `wrench-staging`, `wrench-prod` | Supabase dashboard | Yes. Display names only; the project refs in `SUPABASE_PROJECT_REF` never change. |
| `wrenchaistaging.up.railway.app`, `wrenchaiprod.up.railway.app` | Railway service domains | Yes, but change `APP_URL` in the matching GitHub Environment at the same time, or the post-deploy health check fails. |

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Missing in the ... GitHub Environment" | A secret or variable was not added to that environment (names are case-sensitive). |
| `db push` cannot connect | Use the **Session pooler** string (GitHub runners have no IPv6); password with special characters must be URL-encoded. |
| `railway up` unauthorized | Token belongs to a different Railway environment or was revoked. |
| Health check fails, build passed | Missing `NEXT_PUBLIC_*` variables in Railway, or the app crashed on start: check Railway logs. |

## Switching competitive scoring on

Deploying the scoring migration does **not** start scoring. Each environment's rule version stays off
(`active_from` is empty) until someone runs this once in that environment's SQL editor:

```sql
select public.set_scoring_active('v1', now());
```

Workouts that start after that moment are scored; earlier ones never are. To pause scoring again, set the time
far in the future. Staging can be switched on for testing at any time. **Production needs Caleb's explicit
sign-off** (hard rule 10 in `CLAUDE.md`).

## Reviewing flagged workouts

A workout the automatic checks flag (for example a "run" at car speed) earns 0 points and waits for a person. It
is never accepted automatically. Until there is an admin screen, review is done in the environment's SQL editor:

```sql
-- 1. What is waiting (summaries only, no routes):
select * from public.workouts_awaiting_review;

-- 2. Decide. The reason is shown to the athlete when you reject.
select public.review_workout('<session_id>', 'accepted', 'Downhill race, checked with the athlete', 'Caleb');
select public.review_workout('<session_id>', 'rejected', 'This was recorded in a car', 'Caleb');
```

The athlete's day is re-scored immediately and the points change through new ledger rows. A decision can be
reversed by deciding again (the latest one wins). `review_workout` also works on a workout that was accepted
automatically, for example after a report from a squad. Nothing notifies you when a workout is flagged yet, so
check the list regularly once scoring is on.

## City list

Cities come from GeoNames (`cities15000`, licensed CC BY 4.0), loaded by the `*_cities.sql` migration. The
licence requires credit: show "City data © GeoNames (geonames.org), CC BY 4.0" somewhere users can find it (an
About or Settings screen, and the marketing site footer) **before release**. To refresh the list later, run
`scripts/build-cities-seed.py` on a new download and ship the difference as a new migration (never edit the
merged one). Profiles and squads created before the list existed keep their old typed city as a label but have
no `city_id`, so they do not appear in city or country standings until a city is chosen.

## Testing on staging

Staging is the online copy of the whole system, with its own database, used with test accounts before
production. To use it after a promotion:

1. **Promote**: merge the `dev → qa` PR, then the `qa → staging` PR. The deploy applies every new migration to the
   staging database (dry run first, then apply; it never resets) and deploys the web app.
2. **Dashboard settings** (once): follow [Supabase dashboard setup](mobile-setup.md#supabase-dashboard-setup-staging-and-production)
   for the staging project (passwords, email confirmation, redirect URLs, Apple and Google sign-in).
3. **Mark the database as staging** (once), in the staging SQL editor:
   ```sql
   insert into public.deployment_environment (name) values ('staging');
   ```
   Never run this on production. On production, run `insert ... values ('production')` instead.
4. **Load the demo data** (optional, repeatable): paste `supabase/demo/staging-demo.sql` into the staging SQL editor
   and run it. It refuses to run unless step 3 was done. It switches scoring on for staging and adds 7 demo squads
   with 34 demo athletes and about 330 scored workouts (details at the top of the file). Everything is labelled
   "Demo", the accounts cannot sign in, and the points come from the real scoring engine. Removing the demo data
   later is a delete on a shared database, so it is a separate, deliberate step: ask first.
5. **Point the app at staging**: in `apps/mobile/.env.local`, set `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the staging project's values (publishable key only, never the secret
   key), restart Metro, sign up, choose a city, and start a squad or a workout.

The same demo script works on a local database after
`insert into public.deployment_environment (name) values ('local');`.
