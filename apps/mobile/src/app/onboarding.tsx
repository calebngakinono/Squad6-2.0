import {
  firstIncompleteStepId,
  nextStepId,
  pathFor,
  validateAnswer,
  type AnswerValue,
  type Answers,
  type OnboardingFlow,
  type OnboardingStep,
} from "@squad-six/shared";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Button } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Loading } from "@/components/loading";
import { Notice } from "@/components/notice";
import { Screen } from "@/components/screen";
import { AuthForm } from "@/features/auth/auth-form";
import { completeOnboarding, loadFlow, onboardingErrorMessage } from "@/features/onboarding/api";
import {
  GapLayout,
  NumberedItems,
  OnboardingHeader,
  PlanLayout,
  ProItems,
  StepHeading,
  WelcomeLayout,
} from "@/features/onboarding/layouts";
import { clearProgress, readProgress, writeProgress } from "@/features/onboarding/local";
import { setRouteAfterOnboarding } from "@/features/onboarding/next-route";
import { useOnboardingStatus } from "@/features/onboarding/status";
import { StepInput } from "@/features/onboarding/step-input";
import { routeAfterOnboarding } from "@/features/onboarding/view";
import { useSession } from "@/lib/session";
import { motion, space } from "@/theme/tokens";

// Onboarding runs before the account exists: questions and the pitch first, the account near the end,
// then the Pro offer. Answers stay on the phone until sign-up, then complete_onboarding() saves them.
// Someone already signed in (an account that never finished onboarding) skips the account step.
export default function OnboardingScreen() {
  const { session } = useSession();
  const signedIn = !!session;
  const { refresh } = useOnboardingStatus();
  const [flow, setFlow] = useState<OnboardingFlow | null>(null);
  const [stepId, setStepId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // The step to show after `from`, skipping the account step once signed in.
  const after = useCallback(
    (f: OnboardingFlow, from: string, a: Answers): string | null => {
      let next = nextStepId(f, from, a);
      while (next && signedIn && f.steps.find((s) => s.id === next)?.type === "signup") next = nextStepId(f, next, a);
      return next;
    },
    [signedIn],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const f = await loadFlow();
      const saved = await readProgress(f.version);
      if (!active) return;
      const a = saved?.answers ?? {};
      const path = pathFor(f, a);
      let start = saved && path.includes(saved.stepId) ? saved.stepId : path[0];
      // Just created the account on the sign-up step: carry on to the next one.
      if (signedIn && f.steps.find((s) => s.id === start)?.type === "signup") start = after(f, start, a) ?? start;
      setFlow(f);
      setAnswers(a);
      setStepId(start);
    })().catch(() => active && setLoadError(true));
    return () => {
      active = false;
    };
  }, [attempt, signedIn, after]);

  if (loadError) {
    return (
      <Screen>
        <EmptyState
          title="Couldn't load Squad Six"
          message="Check your connection and try again."
          action={{
            label: "Try again",
            onPress: () => {
              setLoadError(false);
              setAttempt((n) => n + 1);
            },
          }}
        />
      </Screen>
    );
  }
  if (!flow || !stepId) {
    return (
      <Screen scroll={false}>
        <Loading label="Loading" fill />
      </Screen>
    );
  }

  const f = flow;
  const step = f.steps.find((s) => s.id === stepId)!;
  const path = pathFor(f, answers);
  const index = path.indexOf(stepId);
  const value = answers[stepId];
  const answered = validateAnswer(step, value) === null;

  function go(id: string) {
    setError(null);
    setStepId(id);
    writeProgress(f.version, id, answers);
  }

  function setValue(v: AnswerValue | undefined) {
    setError(null);
    const copy = { ...answers };
    if (v === undefined) delete copy[step.id];
    else copy[step.id] = v;
    setAnswers(copy);
    writeProgress(f.version, step.id, copy);
  }

  function back() {
    let i = index - 1;
    while (i > 0 && signedIn && f.steps.find((s) => s.id === path[i])?.type === "signup") i--;
    if (i >= 0) go(path[i]);
  }

  async function finish() {
    const missing = firstIncompleteStepId(f, answers);
    if (missing) {
      go(missing);
      setError("Please answer this one to finish.");
      return;
    }
    if (!signedIn) {
      const signup = path.find((id) => f.steps.find((s) => s.id === id)?.type === "signup");
      if (signup) go(signup);
      return;
    }
    setBusy(true);
    try {
      await completeOnboarding(f, answers);
      await clearProgress();
      setRouteAfterOnboarding(routeAfterOnboarding(answers));
      await refresh(); // The navigator switches to the app.
    } catch (e) {
      setError(onboardingErrorMessage(e));
      setBusy(false);
    }
  }

  function next() {
    const problem = validateAnswer(step, value);
    if (problem) {
      setError(problem);
      return;
    }
    const to = after(f, step.id, answers);
    if (to) go(to);
    else finish();
  }

  const isWelcome = step.type === "info" && step.layout === "welcome";
  const showHeader = index > 0 && step.type !== "paywall";

  return (
    <Screen footer={<Footer step={step} answered={answered} busy={busy} signedIn={signedIn} onNext={next} />}>
      {showHeader && <OnboardingHeader value={index + 1} total={path.length} onBack={back} />}
      {/* The one motion moment: each screen fades in (reanimated follows the system Reduce Motion setting). */}
      <Animated.View key={step.id} entering={FadeIn.duration(motion.duration.slow)} style={[styles.body, isWelcome && styles.grow]}>
        <StepBody step={step} answers={answers} value={value} onChange={setValue} />
        {error && <Notice message={error} />}
      </Animated.View>
    </Screen>
  );
}

type BodyProps = {
  step: OnboardingStep;
  answers: Answers;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue | undefined) => void;
};

function StepBody({ step, answers, value, onChange }: BodyProps) {
  switch (step.type) {
    case "info":
      switch (step.layout) {
        case "welcome":
          return <WelcomeLayout step={step} />;
        case "gap":
          return <GapLayout step={step} answers={answers} />;
        case "plan":
          return <PlanLayout step={step} answers={answers} />;
        case "how_it_works":
          return (
            <>
              <StepHeading title={step.title} body={step.body} />
              <NumberedItems items={step.items} />
            </>
          );
        default:
          return <StepHeading title={step.title} body={step.body} large />;
      }
    case "signup":
      return (
        <>
          <StepHeading title={step.title} body={step.body} />
          <AuthForm initialMode="sign-up" />
        </>
      );
    case "paywall":
      return (
        <>
          <StepHeading title={step.title} body={step.body} />
          <ProItems items={step.items} />
        </>
      );
    default:
      return (
        <>
          <StepHeading title={step.title} body={step.body} />
          <StepInput key={step.id} step={step} value={value} onChange={onChange} />
        </>
      );
  }
}

type FooterProps = { step: OnboardingStep; answered: boolean; busy: boolean; signedIn: boolean; onNext: () => void };

function Footer({ step, answered, busy, signedIn, onNext }: FooterProps) {
  // The account step's own buttons (Apple, Google, email) are its actions.
  if (step.type === "signup") return null;
  const isWelcome = step.type === "info" && step.layout === "welcome";
  return (
    <>
      <Button label={step.cta ?? "Continue"} onPress={onNext} busy={busy} disabled={!answered} />
      {isWelcome && !signedIn && <Button variant="ghost" label="I already have an account" onPress={() => router.push("/sign-in")} />}
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.xl },
  grow: { flexGrow: 1 },
});
