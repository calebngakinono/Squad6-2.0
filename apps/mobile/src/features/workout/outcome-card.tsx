import type { Outcome, WorkoutScore } from "@squad-six/shared";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Pill } from "@/components/badge";
import { Card } from "@/components/card";
import { Loading } from "@/components/loading";
import { Notice } from "@/components/notice";
import { T } from "@/components/screen-text";
import { space } from "@/theme/tokens";
import { ASKS_PLACE, evidenceTips, type TrainingPlace } from "./evidence-tips";
import { ScoreCard } from "./score-card";

type Props = {
  outcome: Outcome;
  score: WorkoutScore | null;
  activity: string;
  healthConnected: boolean;
  retry: () => void;
  retrying: boolean;
  retryFailed: boolean;
};

/** "until 7:30 PM" today, or "until tomorrow at 7:30 PM". */
function until(date: Date, now = new Date()): string {
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return date.toDateString() === now.toDateString() ? `until ${time}` : `until tomorrow at ${time}`;
}

// What happened to one workout, and what to do next. Every outcome says why in plain words; nothing
// waits on "Scoring…" for long, and a workout that earned no points still counts for the person's week.
export function OutcomeCard({ outcome, score, activity, healthConnected, retry, retrying, retryFailed }: Props) {
  const [place, setPlace] = useState<TrainingPlace | null>(null);

  switch (outcome.kind) {
    case "counted":
      return score ? (
        <ScoreCard
          score={score}
          footnote={
            outcome.evidenceOpenUntil
              ? `Squad Six scoring, from what was measured. Apple Health can still add verification points ${until(outcome.evidenceOpenUntil)}.`
              : "Squad Six scoring, from what was measured."
          }
        />
      ) : null;

    case "scoring":
      return <Loading label="Scoring your workout" />;

    case "stuck":
      return (
        <Notice
          tone="warning"
          message={
            retryFailed
              ? "Couldn't reach Squad Six. Check your connection, then try again. Your workout is saved."
              : "This workout hasn't been scored yet. Your workout is saved."
          }
          action={retrying ? undefined : { label: "Try again", onPress: retry }}
        />
      );

    case "unverified": {
      const askPlace = ASKS_PLACE.has(activity);
      return (
        <Card>
          <T variant="headline" accessibilityRole="header">
            Saved. It counts for your week.
          </T>
          <T tone="textMuted">
            It didn&apos;t earn points: only the timer recorded it, and points need something that shows the workout itself.
          </T>
          {outcome.evidenceOpenUntil ? (
            <T variant="small" tone="textMuted">
              {`If a watch or another app saved this workout to Apple Health, it can still earn points ${until(outcome.evidenceOpenUntil)}.`}
            </T>
          ) : null}
          {askPlace && (
            <View style={styles.block}>
              <T variant="label">Where did you train?</T>
              <View style={styles.pills}>
                <Pill label="Outside" selected={place === "outdoors"} onPress={() => setPlace("outdoors")} />
                <Pill label="Indoors" selected={place === "indoors"} onPress={() => setPlace("indoors")} />
              </View>
            </View>
          )}
          {(!askPlace || place) && (
            <View style={styles.block}>
              <T variant="label">To earn points next time</T>
              {evidenceTips(activity, place, healthConnected).map((tip) => (
                <T key={tip} variant="small">
                  {tip}
                </T>
              ))}
            </View>
          )}
        </Card>
      );
    }

    case "not_counted":
      return (
        <Card>
          <T variant="headline" accessibilityRole="header">
            Saved. It counts for your week.
          </T>
          <T tone="textMuted">{outcome.reason ?? "This workout didn't earn points."}</T>
        </Card>
      );

    case "in_review":
      return (
        <Card>
          <T variant="headline" accessibilityRole="header">
            In review
          </T>
          <T tone="textMuted">
            Something in this workout needs a person to check it before it can earn points. It counts for your week
            meanwhile, with 0 points.
          </T>
          {outcome.reason ? (
            <T variant="small" tone="textMuted">
              {outcome.reason}
            </T>
          ) : null}
        </Card>
      );

    case "merged":
      return (
        <Card>
          <T variant="headline" accessibilityRole="header">
            Counted with your previous workout
          </T>
          <T tone="textMuted">{outcome.reason ?? "It was scored together with the workout just before it."}</T>
        </Card>
      );

    case "not_scored":
      return (
        <Card>
          <T variant="headline" accessibilityRole="header">
            Saved. It counts for your week.
          </T>
          <T tone="textMuted">It started before points were being awarded, so it isn&apos;t scored.</T>
        </Card>
      );

    case "expired":
      return (
        <Card variant="sunken">
          <T tone="textMuted">This workout was left running for more than 12 hours, so it was closed and not scored.</T>
        </Card>
      );

    case "rejected":
      return (
        <Card>
          <T variant="headline" accessibilityRole="header">
            Not counted
          </T>
          <T tone="textMuted">{outcome.reason ?? "This workout was reviewed and didn't count."}</T>
        </Card>
      );

    default:
      return null;
  }
}

const styles = StyleSheet.create({
  block: { gap: space.xs },
  pills: { flexDirection: "row", gap: space.sm },
});
