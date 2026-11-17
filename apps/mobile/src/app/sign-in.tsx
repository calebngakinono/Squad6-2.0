import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { TextField } from "@/components/text-field";
import { supabase } from "@/lib/supabase";
import { space, type } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

type Mode = "sign-in" | "sign-up";

export default function SignInScreen() {
  const c = usePalette();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const isSignUp = mode === "sign-up";
  const canSubmit = email.includes("@") && password.length >= 8;

  async function submit() {
    setBusy(true);
    setMessage(null);
    const credentials = { email: email.trim(), password };
    const { data, error } = isSignUp
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials);
    setBusy(false);
    if (error) {
      setMessage({ kind: "error", text: error.message });
    } else if (isSignUp && !data.session) {
      setMessage({ kind: "info", text: "Check your email to confirm your account, then sign in." });
      setMode("sign-in");
    }
    // On success the session listener switches to the signed-in screen.
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[type.title, { color: c.text }]}>
              Squad Six
            </Text>
            <Text style={[type.body, { color: c.textMuted }]}>
              {isSignUp ? "Create your account." : "Sign in to your squad."}
            </Text>
          </View>

          {/* Fields and actions sit in the lower half, within thumb reach. */}
          <View style={styles.form}>
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
            />
            {isSignUp && (
              <Text style={[type.small, { color: c.textMuted }]}>At least 8 characters.</Text>
            )}

            {message && (
              <Text
                accessibilityLiveRegion="polite"
                style={[type.small, { color: message.kind === "error" ? c.danger : c.text }]}
              >
                {message.text}
              </Text>
            )}

            <Button
              label={isSignUp ? "Create account" : "Sign in"}
              onPress={submit}
              busy={busy}
              disabled={!canSubmit}
            />
            <Button
              variant="secondary"
              label={isSignUp ? "I already have an account" : "Create an account"}
              onPress={() => {
                setMessage(null);
                setMode(isSignUp ? "sign-in" : "sign-up");
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "space-between", padding: space.lg, gap: space.xl },
  header: { gap: space.sm, paddingTop: space.xl },
  form: { gap: space.md },
});
