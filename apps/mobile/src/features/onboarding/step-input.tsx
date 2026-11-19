import type { AnswerValue, OnboardingStep } from "@squad-six/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Pill } from "@/components/badge";
import { Button } from "@/components/button";
import { Choice } from "@/components/choice";
import { CityPicker } from "@/components/city-picker";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";
import { useTheme } from "@/theme/theme";
import { borderWidth, radius, size, space } from "@/theme/tokens";
import { deviceTimeZone } from "./api";

type Props = { step: OnboardingStep; value: AnswerValue | undefined; onChange: (v: AnswerValue | undefined) => void };

// Renders any onboarding step type with the shared controls (Choice, Pill, TextField, CityPicker).
export function StepInput({ step, value, onChange }: Props) {
  switch (step.type) {
    case "info":
    case "signup":
    case "paywall":
      return null;
    case "text":
      return (
        <TextField
          // The screen title already asks the question; the field gets a short label.
          label={step.field === "display_name" ? "Name" : step.title}
          value={typeof value === "string" ? value : ""}
          onChangeText={onChange}
          maxLength={step.maxLength}
          autoCapitalize={step.field === "display_name" ? "words" : "sentences"}
          textContentType={step.field === "display_name" ? "name" : "none"}
        />
      );
    case "number": {
      const n = typeof value === "number" ? value : undefined;
      // A short range with every value as a preset (days a week): one tap on a big number.
      const range = Array.from({ length: step.max - step.min + 1 }, (_, i) => step.min + i);
      if (range.length <= 8 && range.every((v) => step.presets.includes(v))) {
        return <NumberKeys values={range} value={n} onChange={onChange} />;
      }
      return (
        <View style={styles.stack}>
          {step.presets.length > 0 && (
            <View style={styles.pills} accessibilityRole="radiogroup">
              {step.presets.map((p) => (
                <Pill key={p} label={String(p)} selected={n === p} onPress={() => onChange(p)} />
              ))}
            </View>
          )}
          <View style={styles.stepper}>
            <Button
              label="−"
              variant="secondary"
              accessibilityLabel="One fewer"
              disabled={n === undefined || n <= step.min}
              onPress={() => onChange((n ?? step.min) - 1)}
            />
            <T
              variant="display"
              numeric
              align="center"
              style={styles.value}
              accessibilityLiveRegion="polite"
              accessibilityLabel={n === undefined ? "Not set" : `${n} days`}
            >
              {n ?? "–"}
            </T>
            <Button
              label="+"
              variant="secondary"
              accessibilityLabel="One more"
              disabled={n !== undefined && n >= step.max}
              onPress={() => onChange(n === undefined ? step.min : n + 1)}
            />
          </View>
        </View>
      );
    }
    case "single_choice":
      return (
        <View style={styles.stack} accessibilityRole="radiogroup">
          {step.options.map((o) => (
            <Choice key={o.value} label={o.label} selected={value === o.value} onPress={() => onChange(o.value)} radio />
          ))}
        </View>
      );
    case "multi_choice": {
      const selected = Array.isArray(value) ? value : [];
      return (
        <View style={styles.stack}>
          {step.options.map((o) => {
            const on = selected.includes(o.value);
            return (
              <Choice
                key={o.value}
                label={o.label}
                selected={on}
                onPress={() => onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
              />
            );
          })}
        </View>
      );
    }
    case "city":
      return <CityPicker label="City" value={typeof value === "number" ? value : null} onChange={(id) => onChange(id ?? undefined)} />;
    case "timezone":
      return <TimeZoneInput value={typeof value === "string" ? value : undefined} onChange={onChange} />;
  }
}

// Days-a-week answers: the chosen number large, then a grid of keys in thumb reach.
function NumberKeys({ values, value, onChange }: { values: number[]; value: number | undefined; onChange: (v: number) => void }) {
  const t = useTheme();
  return (
    <View style={styles.keysBlock}>
      <View style={styles.chosen} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <T variant="display" numeric align="center" tone={value === undefined ? "textMuted" : "text"}>
          {value ?? "–"}
        </T>
        <T variant="small" tone="textMuted" align="center">
          {value === 1 ? "day a week" : "days a week"}
        </T>
      </View>
      <View style={styles.keys} accessibilityRole="radiogroup">
        {values.map((v) => {
          const selected = v === value;
          return (
            <Pressable
              key={v}
              accessibilityRole="radio"
              accessibilityLabel={v === 1 ? "1 day a week" : `${v} days a week`}
              accessibilityState={{ selected }}
              onPress={() => onChange(v)}
              style={({ pressed }) => [
                styles.key,
                {
                  backgroundColor: selected ? t.color.accent : pressed ? t.color.surfacePressed : t.color.surface,
                  borderColor: selected ? t.color.accent : t.color.border,
                },
              ]}
            >
              <T variant="headline" numeric tone={selected ? "onAccent" : "text"}>
                {v}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TimeZoneInput({ value, onChange }: { value: string | undefined; onChange: (v: string | undefined) => void }) {
  const detected = deviceTimeZone();
  return (
    <View style={styles.stack}>
      {detected && (
        <Choice label={`Use this phone's time zone: ${detected}`} selected={value === detected} onPress={() => onChange(detected)} radio />
      )}
      <TextField
        label="Or type one (e.g. America/Denver)"
        value={value && value !== detected ? value : ""}
        onChangeText={(t) => onChange(t.trim() || undefined)}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stepper: { flexDirection: "row", alignItems: "center", gap: space.md },
  value: { flex: 1 },
  keysBlock: { gap: space.lg },
  chosen: { gap: space.xxs, paddingVertical: space.md },
  keys: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  key: {
    flexBasis: "22%",
    flexGrow: 1,
    minHeight: size.control + space.xs,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    borderCurve: "continuous",
    borderWidth: borderWidth.thin,
  },
});
