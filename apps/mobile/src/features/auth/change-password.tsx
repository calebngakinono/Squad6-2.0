import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Notice } from "@/components/notice";
import { TextField } from "@/components/text-field";
import { supabase } from "@/lib/supabase";
import { space } from "@/theme/tokens";
import { passwordProblem, recoveryErrorMessage } from "./recovery";

/**
 * Settings > Change password, for accounts that sign in with email. Also the way out if a reset signed
 * the person in but the new password didn't save. Apple and Google accounts have no password here.
 */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!open) {
    return (
      <View style={styles.wrap}>
        <Button label="Change password" variant="secondary" onPress={() => setOpen(true)} />
        {message && <Notice tone={message.ok ? "success" : "danger"} message={message.text} />}
      </View>
    );
  }

  async function save() {
    const problem = passwordProblem(password);
    if (problem) {
      setMessage({ ok: false, text: problem });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage({ ok: false, text: recoveryErrorMessage(error) });
      return;
    }
    setPassword("");
    setOpen(false);
    setMessage({ ok: true, text: "Password changed. Use it next time you sign in." });
  }

  return (
    <View style={styles.wrap}>
      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        helper="At least 8 characters."
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      {message && !message.ok && <Notice message={message.text} />}
      <Button label="Save new password" onPress={() => void save()} busy={busy} disabled={password.length === 0} />
      <Button
        label="Cancel"
        variant="ghost"
        disabled={busy}
        onPress={() => {
          setPassword("");
          setMessage(null);
          setOpen(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
});
