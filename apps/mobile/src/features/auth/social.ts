import { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } from "@react-native-google-signin/google-signin";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase";
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "./config";
import { socialSignInMessage } from "./messages";

// Native "Sign in with Apple" and "Sign in with Google". The phone gets a signed ID token from Apple or
// Google and hands it to Supabase (signInWithIdToken), which checks it and signs the athlete in. No
// password and no secret on the phone. On success the session listener moves to the signed-in screens.

export type SocialResult = { status: "signed-in" } | { status: "cancelled" } | { status: "error"; message: string };

export const appleSignInAvailable = () =>
  Platform.OS === "ios" ? AppleAuthentication.isAvailableAsync().catch(() => false) : Promise.resolve(false);

/** Google on Android needs a web client ID, which does not exist yet. */
export const googleSignInAvailable = () => Platform.OS === "ios" || GOOGLE_WEB_CLIENT_ID !== null;

export async function signInWithApple(): Promise<SocialResult> {
  // Apple signs a hash of a one-time value; Supabase checks it against the original, so a stolen token
  // cannot be replayed.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") return { status: "cancelled" };
    return { status: "error", message: socialSignInMessage("Apple", e) };
  }
  if (!credential.identityToken) return { status: "error", message: socialSignInMessage("Apple", null) };

  const { error } = await supabase.auth.signInWithIdToken({ provider: "apple", token: credential.identityToken, nonce: rawNonce });
  if (error) return { status: "error", message: socialSignInMessage("Apple", error) };

  // Apple shares the name only on the very first sign-in. Keep it so onboarding can suggest it.
  const { givenName, familyName } = credential.fullName ?? {};
  if (givenName || familyName) {
    await supabase.auth
      .updateUser({ data: { given_name: givenName, family_name: familyName, full_name: [givenName, familyName].filter(Boolean).join(" ") } })
      .catch(() => {});
  }
  return { status: "signed-in" };
}

let configured = false;

export async function signInWithGoogle(): Promise<SocialResult> {
  if (!configured) {
    GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT_ID, ...(GOOGLE_WEB_CLIENT_ID ? { webClientId: GOOGLE_WEB_CLIENT_ID } : {}) });
    configured = true;
  }
  try {
    if (Platform.OS === "android") await GoogleSignin.hasPlayServices();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { status: "cancelled" };
    const token = response.data.idToken;
    if (!token) return { status: "error", message: socialSignInMessage("Google", null) };
    const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token });
    if (error) return { status: "error", message: socialSignInMessage("Google", error) };
    return { status: "signed-in" };
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.IN_PROGRESS || e.code === statusCodes.SIGN_IN_CANCELLED)) return { status: "cancelled" };
    return { status: "error", message: socialSignInMessage("Google", e) };
  }
}

/** Forget the Google account on this phone too, so the next sign-in can pick a different one. */
export async function signOutOfGoogle() {
  if (configured) await GoogleSignin.signOut().catch(() => {});
}
