import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { EmptyState } from "@/components/empty-state";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";
import { JOIN_NOTE_MAX, SEP } from "@squad-six/shared";
import { squadApi } from "@/features/squads/api";
import { normalizeInviteCode, squadErrorMessage } from "@/features/squads/errors";
import { clearPendingInvite } from "@/features/squads/pending-invite";
import { space } from "@/theme/tokens";

type Preview = { name: string; city: string; member_count: number; is_full: boolean };

// Opened from the home screen or an invite link (squadsix://join?code=XXXXXXXX).
export default function JoinScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [input, setInput] = useState(params.code ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [note, setNote] = useState("");
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

  // An invite link fills in the code; look it up straight away. The saved copy has done its job.
  const linkCode = params.code ? normalizeInviteCode(params.code) : null;
  useEffect(() => {
    if (!linkCode) return;
    void clearPendingInvite();
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
      await squadApi.requestToJoin(code, note);
      setSent(true);
    } catch (e) {
      setError(squadErrorMessage(e as { message?: string }));
    } finally {
      setBusy(false);
    }
  }

  const footer = sent ? (
    <Button label="Done" onPress={() => router.back()} />
  ) : preview ? (
    preview.is_full ? undefined : <Button label="Ask to join" onPress={requestToJoin} busy={busy} />
  ) : (
    <Button label="Find squad" onPress={() => code && find(code)} busy={busy} disabled={!code} />
  );

  return (
    <Screen header footer={footer}>
      <Stack.Screen options={{ headerShown: true, title: "Join a squad" }} />
      {sent ? (
        <EmptyState
          title="Request sent"
          message={`The captain of ${preview?.name ?? "the squad"} will approve it. You'll see it on your home screen.`}
        />
      ) : (
        <>
          <TextField
            label="Invite code"
            helper="Ask your captain for the code, or open their invite link."
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

          {preview && (
            <Card>
              <View style={styles.title}>
                <T variant="headline" style={styles.grow}>
                  {preview.name}
                </T>
                {preview.is_full && <Badge label="Full" tone="warning" />}
              </View>
              <T tone="textMuted">
                {preview.city}{SEP}{preview.member_count} of 6 members
              </T>
              {preview.is_full && <T tone="textMuted">This squad is full, so it can&apos;t take new members right now.</T>}
            </Card>
          )}

          {preview && !preview.is_full && (
            <TextField
              label="Message to the captain (optional)"
              helper={`The captain sees this with your name, city, and this season's workouts and points. ${note.length}/${JOIN_NOTE_MAX}`}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={JOIN_NOTE_MAX}
              placeholder="e.g. I run 3 times a week, mostly mornings."
            />
          )}

          {error && <Notice message={error} />}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
});
