import { Alert, Share, StyleSheet, View } from "react-native";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { ButtonRow } from "@/components/button-row";
import { Card } from "@/components/card";
import { ListGroup } from "@/components/list-group";
import { ListRow } from "@/components/list-row";
import { T } from "@/components/screen-text";
import { SectionHeader } from "@/components/section-header";
import { layout, space } from "@/theme/tokens";
import type { Member, MySquad } from "./api";
import { inviteLink } from "./errors";
import { requestMemberSince, requestPlace, requestSeason } from "./request-view";

type Props = {
  squad: MySquad;
  myUserId: string;
  busy: boolean;
  act: (fn: () => Promise<unknown>) => void;
  /**
   * requests: the captain's "Waiting to join" list, which needs action, so Home shows it near the top.
   * manage: members, invite code and leave, at the bottom of Home.
   */
  part: "requests" | "manage";
  actions: {
    decide: (id: string, approve: boolean) => Promise<unknown>;
    remove: (userId: string) => Promise<unknown>;
    makeCaptain: (userId: string) => Promise<unknown>;
    newInviteCode: () => Promise<unknown>;
    leave: () => Promise<unknown>;
  };
};

const SQUAD_MAX = 6;
const displayName = (name: string | null) => name ?? "Athlete (no name yet)";

// The squad parts of the home screen: join requests (captain), then members, invite code, leave.
// The squad's name and city are the home screen's title, so they are not repeated here.
export function SquadPanel({ squad, myUserId, busy, act, part, actions }: Props) {
  const isCaptain = squad.myRole === "captain";
  const others = squad.members.filter((m) => m.userId !== myUserId);
  const full = squad.members.length >= SQUAD_MAX;

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

  // The captain manages a teammate from their row: one tap opens the choices, each still confirmed.
  function memberOptions(m: Member) {
    const name = displayName(m.name);
    Alert.alert(name, undefined, [
      {
        text: "Make captain",
        onPress: () =>
          Alert.alert(`Make ${name} captain?`, "You'll become a regular member.", [
            { text: "Cancel", style: "cancel" },
            { text: "Make captain", onPress: () => act(() => actions.makeCaptain(m.userId)) },
          ]),
      },
      {
        text: "Remove from squad",
        style: "destructive",
        onPress: () =>
          Alert.alert(`Remove ${name}?`, "They can ask to join again with the invite code.", [
            { text: "Cancel", style: "cancel" },
            { text: "Remove", style: "destructive", onPress: () => act(() => actions.remove(m.userId)) },
          ]),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  if (part === "requests") {
    if (!isCaptain || squad.requests.length === 0) return null;
    return (
      <View style={styles.section}>
        <SectionHeader
          title="Waiting to join"
          subtitle={full ? "The squad is full. Remove someone to approve a request." : "You decide who joins."}
        />
        <Card>
          {squad.requests.map((r) => (
            <View key={r.id} style={styles.request}>
              <View style={styles.requestInfo}>
                <T variant="label">{displayName(r.name)}</T>
                <T variant="small" tone="textMuted">
                  {requestPlace(r)} · {requestMemberSince(r)}
                </T>
                <T variant="small" tone="textMuted">
                  {requestSeason(r)}
                </T>
                {r.note ? <T accessibilityLabel={`Their message: ${r.note}`}>{`“${r.note}”`}</T> : null}
              </View>
              <ButtonRow>
                <Button
                  label="Decline"
                  variant="secondary"
                  disabled={busy}
                  accessibilityLabel={`Decline ${displayName(r.name)}`}
                  onPress={() => act(() => actions.decide(r.id, false))}
                />
                <Button
                  label="Approve"
                  disabled={busy || full}
                  accessibilityLabel={`Approve ${displayName(r.name)}`}
                  onPress={() => act(() => actions.decide(r.id, true))}
                />
              </ButtonRow>
            </View>
          ))}
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <SectionHeader title="Members" subtitle={`${squad.members.length} of ${SQUAD_MAX}`} />
        <ListGroup>
          {squad.members.map((m) => {
            const isMe = m.userId === myUserId;
            const manageable = isCaptain && !isMe;
            return (
              <ListRow
                key={m.userId}
                title={displayName(m.name)}
                accessibilityLabel={[displayName(m.name), isMe && "you", m.role === "captain" && "captain"].filter(Boolean).join(", ")}
                trailing={
                  isMe || m.role === "captain" ? (
                    <View style={styles.badges}>
                      {m.role === "captain" && <Badge label="Captain" />}
                      {isMe && <Badge label="You" tone="accent" />}
                    </View>
                  ) : undefined
                }
                onPress={manageable ? () => memberOptions(m) : undefined}
                disabled={manageable && busy}
                accessibilityHint={manageable ? "Make captain or remove from the squad" : undefined}
              />
            );
          })}
        </ListGroup>
      </View>

      {squad.inviteCode && (
        <Card>
          <View style={styles.code}>
            <T variant="label" tone="textMuted">
              Invite code
            </T>
            <T variant="title" numeric selectable accessibilityLabel={`Invite code ${squad.inviteCode.split("").join(" ")}`}>
              {squad.inviteCode}
            </T>
          </View>
          <T variant="small" tone="textMuted">
            {full
              ? "The squad is full, so new requests can't be approved."
              : "People who use this code ask to join. The captain approves each request."}
          </T>
          <Button
            label="Share invite"
            variant="secondary"
            disabled={full}
            onPress={() =>
              Share.share({
                message: `Join my squad "${squad.name}" on Squad Six. Code: ${squad.inviteCode}\n${inviteLink(squad.inviteCode!)}`,
              })
            }
          />
          {isCaptain && (
            <Button
              label="Get a new code"
              variant="ghost"
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

      <Button label="Leave squad" variant="destructiveGhost" disabled={busy} onPress={confirmLeave} />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.xl },
  section: { gap: layout.headingGap },
  request: { gap: space.sm },
  requestInfo: { gap: space.xxs },
  badges: { flexDirection: "row", gap: space.xs },
  code: { gap: space.xxs },
});
