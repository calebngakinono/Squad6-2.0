import { SEP } from "@squad-six/shared";
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
import { inviteMessage, inviteReason, RANKED_AT, SQUAD_MAX } from "./invite";
import { requestMemberSince, requestPlace, requestSeason } from "./request-view";

type Props = {
  squad: MySquad;
  myUserId: string;
  busy: boolean;
  act: (fn: () => Promise<unknown>) => void;
  /**
   * requests: the captain's "Waiting to join" list, which needs action, so Home shows it near the top.
   * invite: the invite code card on its own, first on the Squad tab while the squad is too small to rank.
   * manage: members, invite code (unless shown first) and leave, at the bottom of the Squad tab.
   */
  part: "requests" | "invite" | "manage";
  actions: {
    decide: (id: string, approve: boolean) => Promise<unknown>;
    remove: (userId: string) => Promise<unknown>;
    makeCaptain: (userId: string) => Promise<unknown>;
    newInviteCode: () => Promise<unknown>;
    leave: () => Promise<unknown>;
  };
};

const displayName = (name: string | null) => name ?? "Athlete (no name yet)";

// The squad parts of two tabs: join requests (captain) near the top of Home; members, invite code and
// leave at the bottom of the Squad tab.
// The squad's name and city are already the title on both, so they are not repeated here.
/** The Squad tab shows the invite card first while the squad still needs members to be ranked. */
export const inviteFirst = (squad: MySquad) => !!squad.inviteCode && squad.members.length < RANKED_AT;

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

  const reason = inviteReason(squad.name, squad.members.length);
  const inviteCard = squad.inviteCode ? (
    <Card>
      <View style={styles.code}>
        <T variant="label" tone="textMuted">
          Invite code
        </T>
        <T variant="title" numeric selectable accessibilityLabel={`Invite code ${squad.inviteCode.split("").join(" ")}`}>
          {squad.inviteCode}
        </T>
      </View>
      {reason && squad.members.length < RANKED_AT ? <T variant="label">{reason}</T> : null}
      <T variant="small" tone="textMuted">
        {full
          ? "The squad is full, so new requests can't be approved."
          : "People who use this code ask to join. The captain approves each request."}
      </T>
      <Button
        label="Share invite"
        // While the squad is too small to rank, inviting is the thing to do here.
        variant={part === "invite" ? "primary" : "secondary"}
        disabled={full}
        onPress={() => Share.share({ message: inviteMessage(squad.name, squad.inviteCode!) })}
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
  ) : null;

  if (part === "invite") return inviteCard;

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
                  {requestPlace(r)}{SEP}{requestMemberSince(r)}
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

      {!inviteFirst(squad) && inviteCard}

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
