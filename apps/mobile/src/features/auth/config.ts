// OAuth client IDs are public identifiers (they ship inside the app), not secrets.
// The iOS URL scheme in app.json is this client ID reversed and must stay in step with it.

/** Google Cloud OAuth client of type iOS, bundle ID com.squadsix.app. */
export const GOOGLE_IOS_CLIENT_ID = "578612999066-rb49b7205qsndodfm4keg7njcudm86g5.apps.googleusercontent.com";

/** Google OAuth client of type Web. Needed for Google sign-in on Android only; not created yet. */
export const GOOGLE_WEB_CLIENT_ID: string | null = null;
