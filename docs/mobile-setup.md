# Mobile setup

The app is an Expo **development build**: a version of the app with our native code (keychain, later
HealthKit and GPS) that loads JavaScript from your Mac while you develop. Expo Go cannot run it.

## One-time setup

1. **Apple Developer Program** membership (needed to install builds on a real iPhone).
2. Expo account: `npx eas-cli@latest login`, then from `apps/mobile`: `npx eas-cli@latest init`. This adds the
   EAS project id to `app.json`; commit that change.
3. Register your iPhone: `npx eas-cli@latest device:create` and open the link on the phone.
4. Bundle id is `com.squadsix.app` (iOS and Android). It becomes permanent once registered with Apple,
   so change it in `app.json` **before** the first build if you want a different one.

## Build and install (repeat only after native changes)

```bash
cd apps/mobile
npx eas-cli@latest build --profile development --platform ios
```

EAS builds in the cloud (about 15 minutes) and gives a QR code / link to install on the phone.
A new build is needed only when native code changes (a new native library or `app.json` plugin). JavaScript
changes reload instantly.

## Daily development

1. Environment: `cp apps/mobile/.env.example apps/mobile/.env.local` and fill it in.
   - **Local database:** `pnpm db:start`, then use your Mac's LAN IP (System Settings → Wi-Fi → Details),
     e.g. `http://192.168.1.20:25321`, with the publishable key `db:start` prints. Phone and Mac must be on
     the same Wi-Fi. `127.0.0.1` would point at the phone itself.
   - **Staging:** see step 7 of [Supabase dashboard setup](#supabase-dashboard-setup-staging-and-production).
2. `pnpm --filter @squad-six/mobile start`, then open the Squad Six app on the phone and pick your Mac.

## What works today

Email and password sign-up and sign-in, Sign in with Apple and Google (after the setup below), staying signed in
across restarts (session in the iOS Keychain / Android Keystore), sign-out, and account deletion in Settings.

## Sign in with Apple and Google

Built natively: the phone gets a signed token from Apple or Google and Supabase checks it
(`apps/mobile/src/features/auth/social.ts`). Both need a **new development build** the first time (native code).

One-time setup:
1. **Apple Developer portal** → Identifiers → `com.squadsix.app` → enable **Sign in with Apple**. (EAS may do this
   itself during the next build when it asks you to log in to Apple.)
2. **Google Cloud** → the iOS OAuth client for `com.squadsix.app` (ID in `apps/mobile/src/features/auth/config.ts`;
   its reversed form is the URL scheme in `app.json`). In Google Auth Platform → Data Access, make sure `openid`,
   email and profile are listed. Android will also need a **Web** client ID later.
3. **Each Supabase project** (staging, production): steps 4 and 5 of
   [Supabase dashboard setup](#supabase-dashboard-setup-staging-and-production). Local development already has
   both in `supabase/config.toml`.
4. Rebuild: `npx eas-cli@latest build --profile development --platform ios` from `apps/mobile`, install, and
   restart `pnpm mobile`.

**Before App Store submission:** Apple requires apps that offer Sign in with Apple to revoke the user's Apple
token when they delete their account. That call needs Apple's private key on a server, so it is not built yet
(planned as a server endpoint on the website).

## Device check

Development builds have a **Device check** screen for the phase-1 spike. See [device-spike.md](device-spike.md).

## Supabase dashboard setup (staging and production)

Your Mac's local database reads its settings from `supabase/config.toml`. The online databases don't: each one
has its own settings page in the Supabase dashboard, and you set them **by hand, once per project**. Do every
step below for **staging** first, test, then repeat it for **production**.

| | Staging | Production |
|---|---|---|
| Supabase project (old name, kept on purpose) | `wrench-staging` | `wrench-prod` |
| Website URL (for step 3) | `https://wrenchaistaging.up.railway.app` | `https://wrenchaiprod.up.railway.app` |

Supabase moves menu items around now and then. If a label below doesn't match, search for it with the
dashboard's search box (⌘K).

1. **Open the right project.** Go to [supabase.com/dashboard](https://supabase.com/dashboard) and click the
   project. Check the name at the top of the page before you change anything.
2. **Password rule.** Left sidebar → **Authentication** → **Sign In / Providers** → click **Email**.
   - **Minimum password length:** `8`. Leave **Password requirements** at no extra rules.
   - **Confirm email:** staging, **off**, so test accounts can sign in right away (same as local).
     Production, **on**. The app already shows "Check your email to confirm your account".
   - Click **Save**.
3. **Links.** Authentication → **URL Configuration**.
   - **Site URL:** the website URL from the table above. The confirmation link in sign-up emails opens this page.
   - **Redirect URLs** → **Add URL** → `squadsix://**` (the two stars are needed: they allow every path in the
     app, such as `squadsix://join?code=…`). Save.
4. **Sign in with Apple.** Authentication → Sign In / Providers → **Apple** → turn it on.
   - **Client IDs:** `com.squadsix.app`
   - Leave **Secret Key** empty (only website sign-in would need it). Save.
5. **Sign in with Google.** Same page → **Google** → turn it on.
   - **Client IDs:** the iOS client ID from `apps/mobile/src/features/auth/config.ts`
     (it ends in `.apps.googleusercontent.com`).
   - Turn on **Skip nonce checks** (Google's iPhone library adds a check value the app can't see).
   - Leave the client secret empty. Save.
6. **Mark which database this is** (once). Left sidebar → **SQL Editor** → **New query**, paste one line, click **Run**:
   ```sql
   -- staging only:
   insert into public.deployment_environment (name) values ('staging');
   -- production only (and never the line above):
   insert into public.deployment_environment (name) values ('production');
   ```
   This works only after the first deploy has added the table. To check: **Table Editor** →
   `deployment_environment` has one row.
7. **Point the app at it** (staging only; the production values go into the release build later). Project
   **Settings** → **API Keys** → copy the **publishable** key (`sb_publishable_…`), and **Settings** →
   **Data API** → copy the **Project URL**. Put them in `apps/mobile/.env.local` as
   `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. **Never** copy the secret key
   (`sb_secret_…`) into the app. Restart `pnpm --filter @squad-six/mobile start`.
8. **Check it worked.** On the phone: sign up with a new email and a 7-character password (should be refused),
   then with 8 or more (should work). Sign out, then try **Sign in with Apple**. In the dashboard,
   **Authentication → Users** should list both accounts.

Leave everything else at Supabase's defaults. If you change any of these settings, change `supabase/config.toml` in
the same PR so your local database stays the same as the online ones.
