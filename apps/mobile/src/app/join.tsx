import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";
import { squadApi } from "@/features/squads/api";
import { normalizeInviteCode, squadErrorMessage } from "@/features/squads/errors";
import { space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

type Preview = { name: string; city: string; member_count: number; is_full: boolean };

// Opened from the home screen or an invite link (squadsix://join?code=XXXXXXXX).
export default function JoinScreen() {
  const c = usePalette();
  const params = useLocalSearchParams<{ code?: string }>();
  const [input, setInput] = useState(params.code ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = normalizeInviteCode(input);

  async function find(target: string) {
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const p = await squadApi.preview(target);
      if (!p) setError(squadErrorMessage({ message: "invalid_invite_code" }));
      else setPreview(p);
    } catch (e) {
      setError(squadErrorMessage(e as { message?: string }));
    } finally {
      setBusy(false);
    }
  }

  // An invite link fills in the code; look it up straight away.
  const linkCode = params.code ? normalizeInviteCode(params.code) : null;
  useEffect(() => {
    if (!linkCode) return;
    let active = true;
    squadApi
      .preview(linkCode)
      .then((p) => {
        if (!active) return;
        if (p) setPreview(p);
        else setError(squadErrorMessage({ message: "invalid_invite_code" }));
      })
      .catch((e) => active && setError(squadErrorMessage(e)));
    return () => {
      active = false;
    };
  }, [linkCode]);

  async function requestToJoin() {
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      await squadApi.requestToJoin(code);
      setSent(true);
    } catch (e) {
      setError(squadErrorMessage(e as { message?: string }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView edges={["bottom"]} style={[styles.screen, { backgroundColor: c.background }]}>
      <Stack.Screen options={{ headerShown: true, title: "Join a squad" }} />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {sent ? (
            <Card>
              <T variant="label" accessibilityLiveRegion="polite">
                Request sent
              </T>
              <T tone="textMuted">The captain of {preview?.name ?? "the squad"} will approve it. You&apos;ll see it on your home screen.</T>
              <Button label="Done" onPress={() => router.back()} />
            </Card>
          ) : (
            <>
              <TextField
                label="Invite code"
                value={input}
                onChangeText={(t) => {
                  setInput(t);
                  setPreview(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                returnKeyType="search"
                onSubmitEditing={() => code && find(code)}
              />
              {!preview && <Button label="Find squad" onPress={() => code && find(code)} busy={busy} disabled={!code} />}

              {preview && (
                <Card>
                  <T variant="label">{preview.name}</T>
                  <T tone="textMuted">
                    {preview.city} · {preview.member_count} of 6 members
                  </T>
                  {preview.is_full ? (
                    <T tone="textMuted">This squad is full.</T>
                  ) : (
                    <Button label="Ask to join" onPress={requestToJoin} busy={busy} />
                  )}
                </Card>
              )}

              {error && (
                <T variant="small" tone="danger" accessibilityLiveRegion="polite">
                  {error}
                </T>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.lg, gap: space.md },
});
