import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";
import { appleSignInAvailable, googleSignInAvailable, signInWithApple, signInWithGoogle, type SocialResult } from "@/features/auth/social";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/theme";
import { radius, size, space } from "@/theme/tokens";

type Mode = "sign-in" | "sign-up";
type Busy = null | "email" | "apple" | "google";

export default function SignInScreen() {
  const t = useTheme();
  const [mode, setMode] = useState<Mode>("sign-in");
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
      setMessage({ kind: "info", text: "Check your email to confirm your account, then sign in." });
      setMode("sign-in");
    }
    // On success the session listener switches to the signed-in screens.
  }

  async function social(which: "apple" | "google", run: () => Promise<SocialResult>) {
    setBusy(which);
    setMessage(null);
    const result = await run();
    setBusy(null);
    if (result.status === "error") setMessage({ kind: "error", text: result.message });
  }

  return (
    <Screen
      footer={
        <View style={styles.form}>
          {apple && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={
                t.mode === "dark"
                  ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                  : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
              }
              cornerRadius={radius.md}
              style={[styles.apple, busy !== null && styles.dimmed]}
              onPress={() => busy === null && social("apple", signInWithApple)}
            />
          )}
          {googleSignInAvailable() && (
            <Button
              label="Continue with Google"
              variant="secondary"
              busy={busy === "google"}
              disabled={busy !== null}
              onPress={() => social("google", signInWithGoogle)}
            />
          )}

          <T variant="caption" tone="textMuted" align="center">
            {isSignUp ? "or create an account with email" : "or sign in with email"}
          </T>

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

          {message && (
            <T variant="small" tone={message.kind === "error" ? "danger" : "text"} accessibilityLiveRegion="polite">
              {message.text}
            </T>
          )}

          <Button
            label={isSignUp ? "Create account" : "Sign in"}
            onPress={submit}
            busy={busy === "email"}
            disabled={!canSubmit || (busy !== null && busy !== "email")}
          />
          <Button
            variant="ghost"
            label={isSignUp ? "I already have an account" : "Create an account"}
            onPress={() => {
              setMessage(null);
              setMode(isSignUp ? "sign-in" : "sign-up");
            }}
          />
        </View>
      }
    >
      <View style={styles.header}>
        <T variant="display" accessibilityRole="header">
          Squad Six
        </T>
        <T tone="textMuted">
          {isSignUp ? "Create your account and find your squad." : "Five people are counting on you. Sign in to your squad."}
        </T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm, paddingTop: space.xl },
  form: { gap: space.md },
  apple: { height: size.control, width: "100%" },
  dimmed: { opacity: 0.55 },
});
