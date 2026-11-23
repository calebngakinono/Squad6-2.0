import { CHAT_MAX_LENGTH, groupReactions, REACTIONS, type ChatMessage, type Reaction, type ReactionCount } from "@squad-six/shared";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Loading } from "@/components/loading";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { chatApi, chatErrorMessage } from "@/features/chat/api";
import { useSquadChat } from "@/features/chat/use-squad-chat";
import { activityLabel } from "@/features/history/view";
import { loadSquadHome, type MySquad } from "@/features/squads/api";
import { formatPoints } from "@/features/standings/view";
import { useSession } from "@/lib/session";
import { useTheme } from "@/theme/theme";
import { borderWidth, layout, minTouch, radius, size, space } from "@/theme/tokens";

const time = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// The squad's private chat: text, reactions and shared workouts. Opens over the tabs so the keyboard
// has the whole screen. Newest at the bottom, by the thumb.
export default function ChatScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const [squad, setSquad] = useState<MySquad | null | undefined>(undefined);
  const chat = useSquadChat(squad?.id ?? null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSquadHome(userId).then(
      (h) => setSquad(h.kind === "in-squad" ? h.squad : null),
      () => setSquad(null),
    );
  }, [userId]);

  const names = new Map(squad?.members.map((m) => [m.userId, m.name ?? "Teammate"]) ?? []);
  const isCaptain = squad?.myRole === "captain";
  const grouped = groupReactions(chat.reactions, userId);

  async function send() {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await chatApi.send(body);
      setDraft("");
    } catch (e) {
      setError(chatErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  async function run(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      await chat.refreshReactions();
    } catch (e) {
      setError(chatErrorMessage(e));
    }
  }

  function actionsFor(m: ChatMessage) {
    const mine = m.user_id === userId;
    const items: { label: string; destructive?: boolean; onPress: () => void }[] = [
      ...REACTIONS.map((r) => ({ label: `${r.glyph} ${r.label}`, onPress: () => void run(() => chatApi.react(m.id, r.value)) })),
    ];
    if (mine || isCaptain) {
      items.push({
        label: "Delete",
        destructive: true,
        onPress: () =>
          Alert.alert("Delete this message?", mine ? "It's removed for everyone in the squad." : "As captain you can remove it for everyone.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: () => void run(() => chatApi.remove(m.id)) },
          ]),
      });
    }
    if (!mine) {
      items.push({
        label: "Report",
        onPress: () =>
          Alert.alert("Report this message?", "Squad Six reviews reported messages. The sender isn't told who reported it.", [
            { text: "Cancel", style: "cancel" },
            { text: "Report", style: "destructive", onPress: () => void run(() => chatApi.report(m.id)) },
          ]),
      });
    }
    return items;
  }

  function openActions(m: ChatMessage) {
    if (m.deleted_at) return;
    const items = actionsFor(m);
    if (Platform.OS === "ios") {
      const destructive = items.findIndex((i) => i.destructive);
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...items.map((i) => i.label), "Cancel"], cancelButtonIndex: items.length, destructiveButtonIndex: destructive >= 0 ? destructive : undefined },
        (i) => items[i]?.onPress(),
      );
    } else {
      Alert.alert("Message", undefined, [...items.map((i) => ({ text: i.label, onPress: i.onPress })), { text: "Cancel", style: "cancel" }]);
    }
  }

  const footer = squad ? (
    <Composer draft={draft} setDraft={setDraft} sending={sending} onSend={() => void send()} />
  ) : undefined;

  return (
    <Screen header scroll={false} footer={footer} contentStyle={styles.content}>
      <Stack.Screen options={{ headerShown: true, title: squad?.name ?? "Squad chat" }} />
      {squad === undefined && <Loading label="Loading chat" fill />}
      {squad === null && (
        <EmptyState
          title="No squad chat yet"
          message="Join or start a squad to talk with your teammates."
          action={{ label: "Back", onPress: () => router.back() }}
        />
      )}
      {error && <Notice message={error} />}
      {squad && chat.error && <Notice message="Couldn't load the chat. Check your connection, then open it again." />}
      {squad && !chat.messages && !chat.error && <Loading label="Loading messages" fill />}
      {squad && chat.messages && chat.messages.length === 0 && (
        <EmptyState title="Say hi to your squad" message="Messages here are only for your squad. Share a workout from its summary." />
      )}
      {squad && chat.messages && chat.messages.length > 0 && (
        <FlatList
          inverted
          data={chat.messages}
          keyExtractor={(m) => m.id}
          onEndReached={() => void chat.loadOlder()}
          onEndReachedThreshold={0.4}
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.list}
          ListFooterComponent={chat.loadingOlder ? <Loading label="Loading earlier messages" /> : undefined}
          renderItem={({ item, index }) => {
            const older = chat.messages![index + 1];
            return (
              <MessageView
                message={item}
                mine={item.user_id === userId}
                name={names.get(item.user_id) ?? "Former member"}
                showName={!older || older.user_id !== item.user_id}
                reactions={grouped.get(item.id) ?? []}
                onReact={(r) => void run(() => chatApi.react(item.id, r))}
                onLongPress={() => openActions(item)}
                actions={item.deleted_at ? [] : actionsFor(item)}
              />
            );
          }}
        />
      )}
    </Screen>
  );
}

function Composer({ draft, setDraft, sending, onSend }: { draft: string; setDraft: (s: string) => void; sending: boolean; onSend: () => void }) {
  const t = useTheme();
  const empty = draft.trim().length === 0;
  return (
    <View style={styles.composer}>
      <TextInput
        accessibilityLabel="Message"
        placeholder="Message your squad"
        placeholderTextColor={t.color.textMuted}
        selectionColor={t.color.accent}
        cursorColor={t.color.accent}
        multiline
        maxLength={CHAT_MAX_LENGTH}
        value={draft}
        onChangeText={setDraft}
        style={[
          t.text("body"),
          styles.input,
          { color: t.color.text, backgroundColor: t.color.surface, borderColor: t.color.borderStrong },
        ]}
      />
      <View style={styles.send}>
        <Button label="Send" onPress={onSend} busy={sending} disabled={empty} />
      </View>
    </View>
  );
}

type MessageProps = {
  message: ChatMessage;
  mine: boolean;
  name: string;
  showName: boolean;
  reactions: ReactionCount[];
  onReact: (r: Reaction) => void;
  onLongPress: () => void;
  actions: { label: string; onPress: () => void }[];
};

function MessageView({ message: m, mine, name, showName, reactions, onReact, onLongPress, actions }: MessageProps) {
  const t = useTheme();
  const who = mine ? "You" : name;
  const share = m.kind === "workout" && !m.deleted_at ? m.workout : null;
  const spoken = m.deleted_at
    ? `${who}, message deleted`
    : [
        who,
        time(m.created_at),
        share &&
          `shared a ${activityLabel(share.activity)} workout, ${share.active_minutes} minutes, ${
            share.outcome === "counted" ? `${formatPoints(share.points)} points` : share.outcome === "unverified" ? "unverified" : "not scored"
          }`,
        m.body,
      ]
        .filter(Boolean)
        .join(", ");

  return (
    <View style={[styles.row, mine && styles.rowMine]}>
      {showName && !mine ? (
        <T variant="caption" tone="textMuted">
          {name}
        </T>
      ) : null}
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        accessible
        accessibilityLabel={spoken}
        accessibilityHint={actions.length ? "Actions: react, delete or report" : undefined}
        accessibilityActions={actions.map((a) => ({ name: a.label, label: a.label }))}
        onAccessibilityAction={(e) => actions.find((a) => a.label === e.nativeEvent.actionName)?.onPress()}
        style={[
          styles.bubble,
          { backgroundColor: mine ? t.color.accentSoft : t.color.surface, borderColor: t.color.border },
        ]}
      >
        {m.deleted_at ? (
          <T tone="textMuted">Message deleted</T>
        ) : (
          <>
            {share && (
              <View style={[styles.share, m.body ? { borderBottomColor: t.color.border, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
                <T variant="label">{`${activityLabel(share.activity)} ∙ ${share.active_minutes} min`}</T>
                {share.outcome === "counted" ? (
                  <View style={styles.points}>
                    <T variant="headline" tone="accent" numeric>{`${formatPoints(share.points)} pts`}</T>
                    <T variant="caption" tone="textMuted">
                      Squad Six scoring
                    </T>
                  </View>
                ) : (
                  <T variant="small" tone="textMuted">
                    {share.outcome === "unverified" ? "Unverified: counts for their week, not for points" : "Not scored yet"}
                  </T>
                )}
              </View>
            )}
            {m.body ? <T selectable>{m.body}</T> : null}
          </>
        )}
      </Pressable>
      <View style={[styles.meta, mine && styles.metaMine]}>
        {reactions.map((r) => {
          const def = REACTIONS.find((d) => d.value === r.reaction)!;
          return (
            <Pressable
              key={r.reaction}
              accessibilityRole="button"
              accessibilityLabel={`${def.label}, ${r.count}${r.mine ? ", including you" : ""}`}
              accessibilityState={{ selected: r.mine }}
              onPress={() => onReact(r.reaction)}
              hitSlop={(minTouch - size.controlCompact) / 2}
              style={[
                styles.reaction,
                { borderColor: r.mine ? t.color.accent : t.color.border, backgroundColor: r.mine ? t.color.accentSoft : "transparent" },
              ]}
            >
              <T variant="caption">{`${def.glyph} ${r.count}`}</T>
            </Pressable>
          );
        })}
        <T variant="caption" tone="textMuted">
          {time(m.created_at)}
        </T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingLeft: 0, paddingRight: 0, paddingTop: 0, gap: 0 },
  list: { paddingHorizontal: layout.gutter, paddingVertical: space.md, gap: space.md },
  row: { alignItems: "flex-start", gap: space.xs, maxWidth: "100%" },
  rowMine: { alignItems: "flex-end" },
  bubble: {
    maxWidth: "86%",
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + space.xs,
    gap: space.sm,
  },
  share: { gap: space.xs, paddingBottom: space.sm },
  points: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm },
  metaMine: { justifyContent: "flex-end" },
  reaction: {
    minHeight: size.controlCompact,
    justifyContent: "center",
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    borderWidth: borderWidth.thin,
  },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm },
  input: {
    flex: 1,
    minHeight: size.control,
    maxHeight: 140,
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: borderWidth.thin,
    paddingHorizontal: space.md,
    paddingTop: space.sm + space.xs,
    paddingBottom: space.sm + space.xs,
  },
  send: { minWidth: 88 },
});
