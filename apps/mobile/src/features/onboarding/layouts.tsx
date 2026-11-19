import type { Answers, OnboardingStep } from "@squad-six/shared";
import { cityLabel } from "@squad-six/shared";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card } from "@/components/card";
import { Progress } from "@/components/progress";
import { T } from "@/components/screen-text";
import { loadCity } from "@/features/cities/api";
import { useTheme } from "@/theme/theme";
import { borderWidth, minTouch, radius, size, space } from "@/theme/tokens";
import { gapView, planView } from "./view";

type InfoStep = Extract<OnboardingStep, { type: "info" }>;
type Item = { title: string; body: string };

// The screens of the onboarding that are not plain questions. Copy comes from the flow config;
// numbers come only from the person's own answers.

/** Back chevron and step progress, at the top of every screen between the welcome and the Pro offer. */
export function OnboardingHeader({ value, total, onBack }: { value: number; total: number; onBack?: () => void }) {
  const t = useTheme();
  return (
    <View style={styles.headerRow}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          hitSlop={space.sm}
          style={({ pressed }) => [styles.back, { backgroundColor: pressed ? t.color.surfacePressed : t.color.surfaceSunken }]}
        >
          <View style={[styles.backChevron, { borderColor: t.color.text }]} />
        </Pressable>
      ) : (
        <View style={styles.backSpacer} />
      )}
      <View style={styles.progress}>
        <Progress value={value} total={total} label="Setup progress" />
      </View>
    </View>
  );
}

/** Title and optional body, the top of every onboarding screen. */
export function StepHeading({ title, body, large = false }: { title: string; body?: string; large?: boolean }) {
  return (
    <View style={styles.heading}>
      <T variant={large ? "display" : "title"} accessibilityRole="header">
        {title}
      </T>
      {body ? <T tone="textMuted">{body}</T> : null}
    </View>
  );
}

/**
 * Six seats: you (filled) and five teammates. The one picture of what Squad Six is, drawn as plain
 * geometry from the tokens.
 */
export function SquadSeats() {
  const t = useTheme();
  return (
    <View style={styles.seats} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: 6 }, (_, i) => (
        <View
          key={i}
          style={[
            styles.seat,
            i === 0
              ? { backgroundColor: t.color.accent, borderColor: t.color.accent }
              : { backgroundColor: t.color.accentSoft, borderColor: t.color.accentSoft },
          ]}
        />
      ))}
    </View>
  );
}

export function WelcomeLayout({ step }: { step: InfoStep }) {
  return (
    <View style={styles.welcome}>
      <SquadSeats />
      <StepHeading title={step.title} body={step.body} large />
    </View>
  );
}

export function GapLayout({ step, answers }: { step: InfoStep; answers: Answers }) {
  const v = gapView(step, answers);
  return (
    <View style={styles.block}>
      <T variant="title" accessibilityRole="header">
        {v.title}
      </T>
      {v.number !== null ? (
        <View style={styles.figure} accessible accessibilityLabel={`${v.number} ${v.unit}`}>
          <T variant="display" numeric>
            {v.number.toLocaleString()}
          </T>
          <T variant="label" tone="textMuted">
            {v.unit}
          </T>
        </View>
      ) : null}
      {v.body ? <T tone="textMuted">{v.body}</T> : null}
    </View>
  );
}

/** A short numbered sequence (how it works). The numbers carry the order, so they stay. */
export function NumberedItems({ items }: { items: Item[] }) {
  const t = useTheme();
  return (
    <View style={styles.items}>
      {items.map((item, i) => (
        <View key={item.title} style={styles.item}>
          <View style={[styles.index, { backgroundColor: t.color.accentSoft }]}>
            <T variant="label" tone="accent" numeric>
              {i + 1}
            </T>
          </View>
          <View style={styles.itemText}>
            <T variant="label">{item.title}</T>
            <T variant="small" tone="textMuted">
              {item.body}
            </T>
          </View>
        </View>
      ))}
    </View>
  );
}

export function PlanLayout({ step, answers }: { step: InfoStep; answers: Answers }) {
  const t = useTheme();
  const cityId = answers[step.params.city];
  const [cityName, setCityName] = useState<string | null>(null);
  useEffect(() => {
    if (typeof cityId !== "number") return;
    let active = true;
    loadCity(cityId)
      .then((c) => active && setCityName(c ? cityLabel(c) : null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [cityId]);

  const v = planView(step, answers, cityName, new Date());
  return (
    <View style={styles.block}>
      <StepHeading title={v.title} body={step.body} />
      <Card>
        {v.rows.map((row, i) => (
          <View
            key={row.label}
            style={[styles.planRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.border }]}
            accessible
            accessibilityLabel={`${row.label}: ${row.value}`}
          >
            <T variant="caption" tone="textMuted">
              {row.label}
            </T>
            <T>{row.value}</T>
          </View>
        ))}
      </Card>
    </View>
  );
}

/** What Pro adds. A plain list: Pro is optional and the free app is complete without it. */
export function ProItems({ items }: { items: Item[] }) {
  const t = useTheme();
  return (
    <View style={styles.items}>
      {items.map((item) => (
        <View key={item.title} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: t.color.accent }]} />
          <View style={styles.itemText}>
            <T variant="label">{item.title}</T>
            <T variant="small" tone="textMuted">
              {item.body}
            </T>
          </View>
        </View>
      ))}
    </View>
  );
}

const SEAT = 28;

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: minTouch },
  back: { width: 40, height: 40, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  backChevron: {
    width: size.chevron + 2,
    height: size.chevron + 2,
    borderLeftWidth: borderWidth.thick,
    borderBottomWidth: borderWidth.thick,
    transform: [{ translateX: space.xxs }, { rotate: "45deg" }],
  },
  backSpacer: { width: 40, height: 40 },
  progress: { flex: 1 },
  heading: { gap: space.sm + space.xs },
  block: { gap: space.lg },
  welcome: { flexGrow: 1, justifyContent: "flex-end", gap: space.xl, paddingBottom: space.lg },
  seats: { flexDirection: "row", gap: space.sm },
  seat: { width: SEAT, height: SEAT, borderRadius: radius.pill, borderWidth: borderWidth.thick },
  figure: { gap: space.xxs },
  items: { gap: space.lg },
  item: { flexDirection: "row", gap: space.md, alignItems: "flex-start" },
  index: { width: 32, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  dot: { width: space.sm, height: space.sm, borderRadius: radius.pill, marginTop: space.sm, marginHorizontal: space.sm + space.xs },
  itemText: { flex: 1, gap: space.xxs },
  planRow: { gap: space.xxs, paddingVertical: space.sm + space.xs },
});
