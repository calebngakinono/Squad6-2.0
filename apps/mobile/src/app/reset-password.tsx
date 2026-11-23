import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";
import { passwordProblem, recoveryErrorMessage } from "@/features/auth/recovery";
import { supabase } from "@/lib/supabase";
import { space } from "@/theme/tokens";

// Forgot password, without leaving the app: an emailed 6-digit code, then a new password. Supabase's
// recovery code signs the person in; the new password is saved straight after. Reachable signed out
// (from Sign in) and kept outside the signed-in/out route groups, so the screen survives the moment the
// code signs the person in.
export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? "");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentNote, setSentNote] = useState<string | null>(null);

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.replace(/\D/g, "");

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error: e } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    setBusy(false);
    if (e) {
      setError(recoveryErrorMessage(e));
      return;
    }
    // The same answer whether or not the account exists, so nobody can test which emails have one.
    setSentNote(`If there's an account for ${cleanEmail}, we sent it a 6-digit code. It works for one hour.`);
    setStep("code");
  }

  async function setNewPassword() {
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    const verified = await supabase.auth.verifyOtp({ email: cleanEmail, token: cleanCode, type: "recovery" });
    if (verified.error) {
      setBusy(false);
      setError(recoveryErrorMessage(verified.error));
      return;
    }
    // Signed in now. Save the new password; if this fails, Settings > Change password can set it.
    const updated = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updated.error) {
      setError(`You're signed in, but the new password wasn't saved: ${recoveryErrorMessage(updated.error)} Set it in Settings > Change password.`);
      return;
    }
    router.replace("/");
  }

  return (
    <Screen
      header
      footer={
        step === "email" ? (
          <Button label="Send code" onPress={() => void sendCode()} busy={busy} disabled={!cleanEmail.includes("@")} />
        ) : (
          <Button
            label="Set new password"
            onPress={() => void setNewPassword()}
            busy={busy}
            disabled={cleanCode.length !== 6 || password.length === 0}
          />
        )
      }
    >
      <Stack.Screen options={{ headerShown: true, title: "" }} />
      <View style={styles.header}>
        <T variant="title" accessibilityRole="header">
          Reset your password
        </T>
        <T tone="textMuted">
          {step === "email"
            ? "Enter your account's email. We'll send you a 6-digit code."
            : "Enter the code from the email and choose a new password."}
        </T>
      </View>

      {step === "email" ? (
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={() => cleanEmail.includes("@") && void sendCode()}
        />
      ) : (
        <View style={styles.fields}>
          {sentNote && <Notice tone="info" message={sentNote} />}
          <TextField
            label="6-digit code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={8}
          />
          <TextField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
            helper="At least 8 characters."
          />
          <Button
            label="Send a new code"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setCode("");
              void sendCode();
            }}
          />
          <Button label="Use a different email" variant="ghost" disabled={busy} onPress={() => setStep("email")} />
        </View>
      )}

      {error && <Notice message={error} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
  fields: { gap: space.md },
});
