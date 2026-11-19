import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/theme";
import { radius, size, space, state } from "@/theme/tokens";
import { appleSignInAvailable, googleSignInAvailable, signInWithApple, signInWithGoogle, type SocialResult } from "./social";

export type AuthMode = "sign-in" | "sign-up";
type Busy = null | "email" | "apple" | "google";

type Props = {
  /** sign-up on the onboarding's account screen, sign-in on the Sign in screen. */
  initialMode: AuthMode;
};

// Sign in with Apple, Google, or email and password. Used by the Sign in screen and by the account
// screen near the end of onboarding. On success the session listener moves the app on; nothing here
// navigates.
export function AuthForm({ initialMode }: Props) {
  const t = useTheme();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [apple, setApple] = useState(false);

  useEffect(() => {
    appleSignInAvailable().then(setApple);
  }, []);

  const isSignUp = mode === "sign-up";
  const canSubmit = email.includes("@") && password.length >= 8;
  const google = googleSignInAvailable();

  async function submit() {
    setBusy("email");
    setMessage(null);
    const credentials = { email: email.trim(), password };
    const { data, error } = isSignUp
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials);
    setBusy(null);
    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else if (isSignUp && !data.session) {
      setMessage({ kind: "info", text: "Check your email and tap the link to confirm your account. Then sign in here." });
      setMode("sign-in");
    }
  }

  async function social(which: "apple" | "google", run: () => Promise<SocialResult>) {
    setBusy(which);
    setMessage(null);
    const result = await run();
    setBusy(null);
    if (result.status === "error") setMessage({ kind: "error", text: result.message });
  }

  return (
    <View style={styles.form}>
      {(apple || google) && (
        <View style={styles.social}>
          {apple && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                isSignUp ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              }
              buttonStyle={
                t.mode === "dark" ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={radius.md}
              style={[styles.apple, busy !== null && styles.dimmed]}
              onPress={() => busy === null && social("apple", signInWithApple)}
            />
          )}
          {google && (
            <Button
              label="Continue with Google"
              variant="secondary"
              busy={busy === "google"}
              disabled={busy !== null}
              onPress={() => social("google", signInWithGoogle)}
            />
          )}
          <View style={styles.divider} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={[styles.rule, { backgroundColor: t.color.border }]} />
            <T variant="caption" tone="textMuted">
              or with email
            </T>
            <View style={[styles.rule, { backgroundColor: t.color.border }]} />
          </View>
        </View>
      )}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={isSignUp ? "new-password" : "current-password"}
        textContentType={isSignUp ? "newPassword" : "password"}
        returnKeyType="go"
        onSubmitEditing={() => canSubmit && submit()}
        helper={isSignUp ? "At least 8 characters." : undefined}
      />

      {message && <Notice message={message.text} tone={message.kind === "error" ? "danger" : "info"} />}

      <View style={styles.actions}>
        <Button
          label={isSignUp ? "Create account" : "Sign in"}
          variant={apple || google ? "secondary" : "primary"}
          onPress={submit}
          busy={busy === "email"}
          disabled={!canSubmit || (busy !== null && busy !== "email")}
        />
        <Button
          variant="ghost"
          label={isSignUp ? "I already have an account" : "Create an account with email"}
          onPress={() => {
            setMessage(null);
            setMode(isSignUp ? "sign-in" : "sign-up");
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.md },
  social: { gap: space.sm + space.xs },
  apple: { height: size.control, width: "100%" },
  dimmed: { opacity: state.disabledOpacity },
  divider: { flexDirection: "row", alignItems: "center", gap: space.sm + space.xs, paddingTop: space.xs },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  actions: { gap: space.xs },
});
