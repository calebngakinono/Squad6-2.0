// What would let a workout earn points next time, by activity. Pure, so it is unit-tested. These are
// tips only: an answer to "where did you train?" never earns points by itself.

export type TrainingPlace = "outdoors" | "indoors";

/** Activities where indoors or outdoors changes what can verify the workout. */
export const ASKS_PLACE = new Set(["run", "walk", "hike", "cycle"]);

const HEALTH_APP = "saves workouts to Apple Health";

/**
 * The one or two most useful things to do differently. `place` is the person's own answer, only
 * asked for ASKS_PLACE activities; `healthConnected` is whether Apple Health is connected on this phone.
 */
export function evidenceTips(activity: string, place: TrainingPlace | null, healthConnected: boolean): string[] {
  const tips: string[] = [];
  switch (activity) {
    case "strength":
      tips.push("Log at least 6 sets as you go, tapping Done after each one.");
      break;
    case "run":
    case "walk":
    case "hike":
      tips.push(
        place === "indoors"
          ? "On a treadmill, keep your phone in a pocket or armband so it can count your steps."
          : "Outside, allow Location for Squad Six so GPS can record the route, and keep your phone on you.",
      );
      break;
    case "cycle":
      tips.push(
        place === "indoors"
          ? `Indoors, record the ride with a bike app, smart trainer or watch that ${HEALTH_APP}.`
          : "Outside, allow Location for Squad Six so GPS can record the ride.",
      );
      break;
    case "swim":
      tips.push(`Record the swim with a watch or swim tracker that ${HEALTH_APP}.`);
      break;
    case "yoga":
      tips.push(`Record the session with a watch, a heart-rate strap or a yoga app that ${HEALTH_APP}.`);
      break;
    default:
      tips.push("Keep your phone in a pocket or armband so it can count your movement.");
  }
  if (!healthConnected) {
    tips.push("Connect Apple Health so a workout from a watch or another app is matched automatically.");
  }
  return tips;
}
