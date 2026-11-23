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
| `wrenchaiprod.up.railway.app` (staging is now `squad6stage.up.railway.app`) | Railway service domains | Yes, but change `APP_URL` in the matching GitHub Environment at the same time, or the post-deploy health check fails. |

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

## Reviewing reported chat messages

Members can report a squad-chat message (once each). Nothing notifies you yet, so check the queue regularly.
In the environment's SQL editor:

```sql
-- 1. What is waiting:
select * from public.chat_reports_awaiting_review;

-- 2. Remove a message for everyone (keeps a "Message deleted" placeholder), then close its reports:
update public.squad_messages set body = null, workout = case when kind = 'workout' then '{}'::jsonb end,
  workout_session_id = null, deleted_at = now() where id = '<message_id>';
update public.squad_message_reports set resolved_at = now() where message_id = '<message_id>';
```

A captain can also delete any message in their own squad from the app.

## City list

Cities come from GeoNames (`cities15000`, licensed CC BY 4.0), loaded by the `*_cities.sql` migration. The
licence requires credit: show "City data © GeoNames (geonames.org), CC BY 4.0" somewhere users can find it (an
About or Settings screen, and the marketing site footer) **before release**. To refresh the list later, run
`scripts/build-cities-seed.py` on a new download and ship the difference as a new migration (never edit the
merged one). Profiles and squads created before the list existed keep their old typed city as a label but have
no `city_id`, so they do not appear in city or country standings until a city is chosen.

## Password reset email

The app resets passwords with a 6-digit code (Sign in > Forgot password?), so it never depends on an email link
opening the app. The reset email must therefore contain the code. Locally this comes from
`supabase/templates/recovery.html` (wired up in `supabase/config.toml`). On **staging and production**, set it once
in the dashboard: Authentication → **Emails** → **Reset password**:

- Subject: `Your Squad Six code`
- Body: the contents of `supabase/templates/recovery.html` (the important part is `{{ .Token }}`, the code).

**Before launch: send email through your own SMTP provider.** Supabase's built-in sender is meant for testing:
it sends only a few emails an hour and may only deliver to your project team's addresses. Sign-up confirmations
and password resets for real people need a provider (for example Resend, Postmark or Amazon SES), set under
Authentication → Emails → SMTP settings on the production project.

## TestFlight builds

TestFlight builds are store-signed builds of the iPhone app that testers install from Apple's TestFlight app.
They point at **staging** until the production database is released.

- Profile `testflight` in `apps/mobile/eas.json`: extends `production` (App Store distribution, build number
  increased automatically) but uses the EAS **preview** environment.
- The EAS **preview** environment holds `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (staging) and `EXPO_PUBLIC_WEBSITE_URL`, all plain text because they ship inside the app anyway. A store
  build bundles the code on EAS's servers, where `.env.local` never goes, so without these the app has no
  server to talk to. Check them with `npx eas-cli@latest env:list preview`.
- The `production` environment is still empty on purpose: fill it with the production values when production
  is released, and use the `production` profile for the App Store release.

Run it from `apps/mobile` in your own terminal (the first run asks for your Apple ID and creates the signing
certificate and, if needed, the app in App Store Connect):

```bash
npx eas-cli@latest build --profile testflight --platform ios --auto-submit
```

After Apple finishes processing (usually 10–30 minutes), add yourself as an **internal tester** in App Store
Connect → TestFlight. Internal testing needs no review. External testers need a short beta review, and Apple
asks what the app does with Health data and for the privacy policy URL.

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
   and run it. It refuses to run unless step 3 was done. It switches scoring on for staging and adds 8 demo squads
   and 40 demo athletes, 8 weeks of workouts up to today, this week's challenges, squad chat with shared workouts
   and reactions, a planned home-city move and one athlete hidden from rankings (details at the top of the file).
   Everything is labelled "Demo", the demo accounts cannot sign in, and every point comes from the real scoring
   engine. Run it again any day to top the workouts up to today.

   **Presenter account** (for presenting the app): in the app pointed at staging, sign up with an email you
   control (name it so it reads as demo, e.g. "Caleb (demo)"), finish onboarding, and do not join a squad. Put
   that email on the `insert into demo_settings` line near the top of the script, then run it. The presenter
   becomes captain of "Demo · Summit Crew" with 8 weeks of training, a goal streak, a high place in Saint George,
   unread chat and someone waiting to join. Today is left open, so finishing a workout live paints today's mark.

   **Remove it all**: `supabase/demo/staging-demo-remove.sql` deletes the demo athletes, the "Demo · ..." squads and
   their chat, the seed's workouts and the points awarded for them. The presenter account is kept (out of the
   squad, its demo workouts and points removed). It refuses to run outside staging or local.
5. **Point the app at staging**: in `apps/mobile/.env.local`, set `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the staging project's values (publishable key only, never the secret
   key), restart Metro, sign up, choose a city, and start a squad or a workout.

The same demo script works on a local database after
`insert into public.deployment_environment (name) values ('local');`.
