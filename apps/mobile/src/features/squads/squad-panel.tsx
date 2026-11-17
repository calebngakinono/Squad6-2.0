import { Alert, Share, StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { Card } from "@/components/card";
import { T } from "@/components/screen-text";
import { space } from "@/theme/tokens";
import type { MySquad } from "./api";
import { inviteLink } from "./errors";

type Props = {
  squad: MySquad;
  myUserId: string;
  busy: boolean;
  act: (fn: () => Promise<unknown>) => void;
  actions: {
    decide: (id: string, approve: boolean) => Promise<unknown>;
    remove: (userId: string) => Promise<unknown>;
    makeCaptain: (userId: string) => Promise<unknown>;
    newInviteCode: () => Promise<unknown>;
    leave: () => Promise<unknown>;
  };
};

const displayName = (name: string | null) => name ?? "Athlete (no name yet)";

export function SquadPanel({ squad, myUserId, busy, act, actions }: Props) {
  const isCaptain = squad.myRole === "captain";
  const others = squad.members.filter((m) => m.userId !== myUserId);

  function confirmLeave() {
    const successor = isCaptain ? others[0] : undefined;
    const detail = !isCaptain
      ? "You can join another squad afterwards."
      : successor
        ? `${displayName(successor.name)} will become captain.`
        : "You're the last member, so the squad will be closed.";
    Alert.alert(`Leave ${squad.name}?`, detail, [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: () => act(actions.leave) },
    ]);
  }

  return (
    <View style={styles.stack}>
      <View style={styles.header}>
        <T variant="title" accessibilityRole="header">
          {squad.name}
        </T>
        <T tone="textMuted">
          {squad.city} · {squad.members.length} of 6 members
        </T>
        {squad.description ? <T tone="textMuted">{squad.description}</T> : null}
      </View>

      {isCaptain && squad.requests.length > 0 && (
        <Card>
          <T variant="label">Waiting to join ({squad.requests.length})</T>
          {squad.requests.map((r) => (
            <View key={r.id} style={styles.row}>
              <T style={styles.grow}>{displayName(r.name)}</T>
              <View style={styles.rowActions}>
                <Button label="Decline" variant="secondary" disabled={busy} onPress={() => act(() => actions.decide(r.id, false))} />
                <Button
                  label="Approve"
                  disabled={busy || squad.members.length >= 6}
                  onPress={() => act(() => actions.decide(r.id, true))}
                />
              </View>
            </View>
          ))}
          {squad.members.length >= 6 && <T variant="small" tone="textMuted">The squad is full.</T>}
        </Card>
      )}

      <Card>
        <T variant="label">Members</T>
        {squad.members.map((m) => {
          const isMe = m.userId === myUserId;
          return (
            <View key={m.userId} style={styles.member}>
              <T>
                {displayName(m.name)}
                {isMe ? " (you)" : ""}
                {m.role === "captain" ? " · Captain" : ""}
              </T>
              {isCaptain && !isMe && (
                <View style={styles.rowActions}>
                  <Button
                    label="Make captain"
                    variant="secondary"
                    disabled={busy}
                    onPress={() =>
                      Alert.alert(`Make ${displayName(m.name)} captain?`, "You'll become a regular member.", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Make captain", onPress: () => act(() => actions.makeCaptain(m.userId)) },
                      ])
                    }
                  />
                  <Button
                    label="Remove"
                    variant="secondary"
                    disabled={busy}
                    onPress={() =>
                      Alert.alert(`Remove ${displayName(m.name)}?`, "They can ask to join again with the invite code.", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Remove", style: "destructive", onPress: () => act(() => actions.remove(m.userId)) },
                      ])
                    }
                  />
                </View>
              )}
            </View>
          );
        })}
      </Card>

      {squad.inviteCode && (
        <Card>
          <T variant="label">Invite code</T>
          <T variant="title" selectable accessibilityLabel={`Invite code ${squad.inviteCode.split("").join(" ")}`}>
            {squad.inviteCode}
          </T>
          <T variant="small" tone="textMuted">
            People who use this code ask to join. The captain approves each request.
          </T>
          <Button
            label="Share invite"
            disabled={squad.members.length >= 6}
            onPress={() =>
              Share.share({
                message: `Join my squad "${squad.name}" on Squad Six. Code: ${squad.inviteCode}\n${inviteLink(squad.inviteCode!)}`,
              })
            }
          />
          {isCaptain && (
            <Button
              label="Get a new code"
              variant="secondary"
              disabled={busy}
              onPress={() =>
                Alert.alert("Replace the invite code?", "The old code stops working right away.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Replace", onPress: () => act(actions.newInviteCode) },
                ])
              }
            />
          )}
        </Card>
      )}

      <Button label="Leave squad" variant="secondary" disabled={busy} onPress={confirmLeave} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  header: { gap: space.xs },
  row: { gap: space.sm },
  grow: { flexShrink: 1 },
  rowActions: { flexDirection: "row", gap: space.sm, flexWrap: "wrap" },
  member: { gap: space.sm },
});
