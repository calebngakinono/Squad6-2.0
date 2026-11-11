import { firstIncompleteStepId, nextStepId, pathFor, validateAnswer, type AnswerValue, type Answers } from "@squad-six/shared";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components/button";
import { T } from "@/components/screen-text";
import { completeOnboarding, loadOnboarding, onboardingErrorMessage, saveProgress, type OnboardingState } from "@/features/onboarding/api";
import { useOnboardingStatus } from "@/features/onboarding/status";
import { StepInput } from "@/features/onboarding/step-input";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { space } from "@/theme/tokens";
import { usePalette } from "@/theme/use-palette";

export default function OnboardingScreen() {
  const c = usePalette();
  const { session } = useSession();
  const userId = session!.user.id;
  const { refresh } = useOnboardingStatus();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [stepId, setStepId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    loadOnboarding(userId)
      .then((s) => {
        if (!active) return;
        setState(s);
        setAnswers(s.answers);
        // Resume where the athlete left off, if that step is still on their path.
        const path = pathFor(s.flow, s.answers);
        setStepId(s.step && path.includes(s.step) ? s.step : path[0]);
      })
      .catch(() => active && setLoadError(true));
    return () => {
      active = false;
    };
  }, [userId]);

  if (loadError) {
    return (
      <SafeAreaView style={[styles.screen, styles.center, { backgroundColor: c.background }]}>
        <T tone="danger">Couldn&apos;t load the setup questions.</T>
        <Button label="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />
      </SafeAreaView>
    );
  }
  if (!state || !stepId) {
    return (
      <SafeAreaView style={[styles.screen, styles.center, { backgroundColor: c.background }]}>
        <ActivityIndicator accessibilityLabel="Loading" />
      </SafeAreaView>
    );
  }

  const { flow } = state;
  const step = flow.steps.find((s) => s.id === stepId)!;
  const path = pathFor(flow, answers);
  const index = path.indexOf(stepId);
  const value = answers[stepId];

  function setValue(v: AnswerValue | undefined) {
    setError(null);
    setAnswers((a) => {
      const copy = { ...a };
      if (v === undefined) delete copy[stepId!];
      else copy[stepId!] = v;
      return copy;
    });
  }

  async function goNext() {
    const problem = validateAnswer(step, value);
    if (problem) {
      setError(problem);
      return;
    }
    const next = nextStepId(flow, step.id, answers);
    setBusy(true);
    try {
      if (next) {
        await saveProgress(flow, next, answers);
        setStepId(next);
      } else {
        const missing = firstIncompleteStepId(flow, answers);
        if (missing) {
          setStepId(missing);
          setError("Please answer this one to finish.");
          return;
        }
        await completeOnboarding(flow, answers);
        await refresh(); // The navigator switches to the app.
      }
    } catch (e) {
      setError(onboardingErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const isLast = nextStepId(flow, step.id, answers) === null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <T variant="small" tone="textMuted" accessibilityLabel={`Step ${index + 1} of ${path.length}`}>
            {index + 1} / {path.length}
          </T>
          <View style={styles.header}>
            <T variant="title" accessibilityRole="header">
              {step.title}
            </T>
            {step.body ? <T tone="textMuted">{step.body}</T> : null}
          </View>

          <View style={styles.input}>
            <StepInput key={step.id} step={step} value={value} onChange={setValue} />
          </View>

          {error && (
            <T variant="small" tone="danger" accessibilityLiveRegion="polite">
              {error}
            </T>
          )}
        </ScrollView>

        {/* Navigation stays at the bottom, in thumb reach. */}
        <View style={styles.footer}>
          <Button label={isLast ? "Finish" : step.type === "info" ? "Continue" : "Next"} onPress={goNext} busy={busy} />
          {index > 0 && (
            <Button label="Back" variant="secondary" disabled={busy} onPress={() => { setError(null); setStepId(path[index - 1]); }} />
          )}
          {!step.required && step.type !== "info" && value === undefined && (
            <T variant="small" tone="textMuted" style={styles.center}>
              Optional
            </T>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", gap: space.md, textAlign: "center" },
  content: { padding: space.lg, gap: space.lg, flexGrow: 1 },
  header: { gap: space.sm },
  input: { gap: space.md },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
});
