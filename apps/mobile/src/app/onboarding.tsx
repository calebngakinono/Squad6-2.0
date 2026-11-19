import { firstIncompleteStepId, nextStepId, pathFor, validateAnswer, type AnswerValue, type Answers } from "@squad-six/shared";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { ButtonRow } from "@/components/button-row";
import { EmptyState } from "@/components/empty-state";
import { Loading } from "@/components/loading";
import { Notice } from "@/components/notice";
import { Progress } from "@/components/progress";
import { Screen } from "@/components/screen";
import { T } from "@/components/screen-text";
import { completeOnboarding, loadOnboarding, onboardingErrorMessage, saveProgress, type OnboardingState } from "@/features/onboarding/api";
import { useOnboardingStatus } from "@/features/onboarding/status";
import { StepInput } from "@/features/onboarding/step-input";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { space } from "@/theme/tokens";

export default function OnboardingScreen() {
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
      <Screen footer={<Button label="Sign out" variant="secondary" onPress={() => supabase.auth.signOut()} />}>
        <EmptyState
          title="Couldn't load the setup questions"
          message="Check your connection, then close and reopen the app."
        />
      </Screen>
    );
  }
  if (!state || !stepId) {
    return (
      <Screen scroll={false}>
        <Loading label="Loading setup" fill />
      </Screen>
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
  const next = <Button label={isLast ? "Finish" : step.type === "info" ? "Continue" : "Next"} onPress={goNext} busy={busy} />;

  return (
    <Screen
      // Navigation stays at the bottom, in thumb reach.
      footer={
        index > 0 ? (
          <ButtonRow>
            <Button
              label="Back"
              variant="secondary"
              disabled={busy}
              onPress={() => {
                setError(null);
                setStepId(path[index - 1]);
              }}
            />
            {next}
          </ButtonRow>
        ) : (
          next
        )
      }
    >
      <View style={styles.progress}>
        <Progress value={index + 1} total={path.length} label="Setup progress" />
        <T variant="caption" tone="textMuted" importantForAccessibility="no" accessibilityElementsHidden>
          {`Step ${index + 1} of ${path.length}`}
        </T>
      </View>

      <View style={styles.header}>
        <T variant="title" accessibilityRole="header">
          {step.title}
        </T>
        {step.body ? <T tone="textMuted">{step.body}</T> : null}
        {!step.required && step.type !== "info" && <Badge label="Optional" />}
      </View>

      <StepInput key={step.id} step={step} value={value} onChange={setValue} />

      {error && <Notice message={error} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { gap: space.sm },
  header: { gap: space.sm },
});
