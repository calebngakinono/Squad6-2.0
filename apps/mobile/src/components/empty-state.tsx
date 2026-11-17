import { StyleSheet, View } from "react-native";
import { Button } from "@/components/button";
import { T } from "@/components/screen-text";
import { space } from "@/theme/tokens";

type Props = {
  /** What is missing, in plain words ("No workouts yet"). */
  title: string;
  /** Why, and what happens next ("Finished workouts show up here with their points."). */
  message?: string;
  /** The one thing to do about it. */
  action?: { label: string; onPress: () => void };
};

// Shown in place of content that does not exist yet. Says what is missing and how to change that;
// never shows demo or made-up data as filler.
export function EmptyState({ title, message, action }: Props) {
  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.text}>
        <T variant="headline" align="center">
          {title}
        </T>
        {message ? (
          <T tone="textMuted" align="center">
            {message}
          </T>
        ) : null}
      </View>
      {action ? <Button label={action.label} variant="secondary" onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, paddingVertical: space.xxl, paddingHorizontal: space.md },
  text: { gap: space.sm },
});
