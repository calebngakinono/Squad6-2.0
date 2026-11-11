import type { AnswerValue, OnboardingStep } from "@squad-six/shared";
import { Pressable, StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { T } from "@/components/screen-text";
import { TextField } from "@/components/text-field";
import { minTouch, radius, space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";
import { deviceTimeZone } from "./api";

type Props = { step: OnboardingStep; value: AnswerValue | undefined; onChange: (v: AnswerValue | undefined) => void };

// Renders any onboarding step type. Visual design is a placeholder until the storyboard arrives.
export function StepInput({ step, value, onChange }: Props) {
  switch (step.type) {
    case "info":
      return null;
    case "text":
      return (
        <TextField
          label={step.title}
          value={typeof value === "string" ? value : ""}
          onChangeText={onChange}
          maxLength={step.maxLength}
          autoCapitalize={step.field === "display_name" || step.field === "city" ? "words" : "sentences"}
          textContentType={step.field === "city" ? "addressCity" : step.field === "display_name" ? "name" : "none"}
        />
      );
    case "number": {
      const n = typeof value === "number" ? value : undefined;
      return (
        <View style={styles.stack}>
          {step.presets.length > 0 && (
            <View style={styles.chips} accessibilityRole="radiogroup">
              {step.presets.map((p) => (
                <Choice key={p} label={String(p)} selected={n === p} onPress={() => onChange(p)} radio />
              ))}
            </View>
          )}
          <View style={styles.stepper}>
            <Button label="−" variant="secondary" disabled={n === undefined || n <= step.min} onPress={() => onChange((n ?? step.min) - 1)} />
            <T variant="title" accessibilityLiveRegion="polite" accessibilityLabel={n === undefined ? "Not set" : `${n} days`}>
              {n ?? "–"}
            </T>
            <Button label="+" variant="secondary" disabled={n !== undefined && n >= step.max} onPress={() => onChange(n === undefined ? step.min : n + 1)} />
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
    case "timezone":
      return <TimeZoneInput value={typeof value === "string" ? value : undefined} onChange={onChange} />;
  }
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

function Choice({ label, selected, onPress, radio = false }: { label: string; selected: boolean; onPress: () => void; radio?: boolean }) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole={radio ? "radio" : "checkbox"}
      accessibilityState={radio ? { selected } : { checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        {
          borderColor: selected ? c.accent : c.border,
          backgroundColor: selected ? c.surface : "transparent",
          borderWidth: selected ? 2 : 1,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <T variant="body">{label}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stepper: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  choice: { minHeight: minTouch + 4, borderRadius: radius.md, paddingHorizontal: space.md, justifyContent: "center" },
});
