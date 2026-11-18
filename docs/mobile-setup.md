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
   - **Staging:** the staging project's URL and **publishable** key. Never the secret key.
2. `pnpm --filter @squad-six/mobile start`, then open the Squad Six app on the phone and pick your Mac.

## What works today

Email and password sign-up and sign-in, staying signed in across restarts (session in the iOS Keychain /
Android Keystore), and sign-out. Sign in with Apple and Google come later in phase 1 once the developer
accounts are set up.

## Sign in with Apple and Google

Built natively: the phone gets a signed token from Apple or Google and Supabase checks it
(`apps/mobile/src/features/auth/social.ts`). Both need a **new development build** the first time (native code).

One-time setup:
1. **Apple Developer portal** → Identifiers → `com.squadsix.app` → enable **Sign in with Apple**. (EAS may do this
   itself during the next build when it asks you to log in to Apple.)
2. **Google Cloud** → the iOS OAuth client for `com.squadsix.app` (ID in `apps/mobile/src/features/auth/config.ts`;
   its reversed form is the URL scheme in `app.json`). In Google Auth Platform → Data Access, make sure `openid`,
   email and profile are listed. Android will also need a **Web** client ID later.
3. **Each Supabase project** (staging, production) → Authentication → Sign In / Providers:
   - **Apple**: enable; Client IDs `com.squadsix.app`; leave the secret empty (only web sign-in needs it).
   - **Google**: enable; Client IDs = the iOS client ID; turn on **Skip nonce checks** (Google's iOS library adds
     a nonce the app cannot see).
   Local development already has both in `supabase/config.toml`.
4. Rebuild: `npx eas-cli@latest build --profile development --platform ios` from `apps/mobile`, install, and
   restart `pnpm mobile`.

**Before App Store submission:** Apple requires apps that offer Sign in with Apple to revoke the user's Apple
token when they delete their account. That call needs Apple's private key on a server, so it is not built yet
(planned as a server endpoint on the website).

## Device check

Development builds have a **Device check** screen for the phase-1 spike. See [device-spike.md](device-spike.md).

## Server settings to match

Local `supabase/config.toml` requires 8-character passwords and allows the `squadsix://` redirect. Set the
same in the staging and production dashboards (Authentication → Policies / URL Configuration) before
testing there.
