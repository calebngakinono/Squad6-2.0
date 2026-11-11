import { useState } from "react";
import { Card } from "@/components/card";
import { Button } from "@/components/button";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";

// Shown until the athlete has a display name: squadmates need something to recognise them by.
export function NameCard({ onSave }: { onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const trimmed = name.trim();
  return (
    <Card>
      <T variant="label">What should your squad call you?</T>
      <TextField
        label="Display name"
        value={name}
        onChangeText={setName}
        maxLength={80}
        autoComplete="name"
        textContentType="name"
      />
      <Button
        label="Save name"
        busy={busy}
        disabled={trimmed.length < 1}
        onPress={async () => {
          setBusy(true);
          await onSave(trimmed).finally(() => setBusy(false));
        }}
      />
    </Card>
  );
}
