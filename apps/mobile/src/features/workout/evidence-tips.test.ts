import { describe, expect, it } from "vitest";
import { ASKS_PLACE, evidenceTips } from "./evidence-tips";

describe("evidenceTips", () => {
  it("gives each activity a way to count without a watch where one exists", () => {
    expect(evidenceTips("strength", null, true)[0]).toMatch(/6 sets/);
    expect(evidenceTips("hiit", null, true)[0]).toMatch(/pocket or armband/);
    expect(evidenceTips("run", "indoors", true)[0]).toMatch(/treadmill/);
    expect(evidenceTips("run", "outdoors", true)[0]).toMatch(/Location/);
  });

  it("points yoga, swimming and indoor rides at any app or device that saves to Apple Health", () => {
    for (const [activity, place] of [["yoga", null], ["swim", null], ["cycle", "indoors"]] as const) {
      expect(evidenceTips(activity, place, true)[0]).toMatch(/Apple Health/);
    }
  });

  it("adds Connect Apple Health only when it isn't connected", () => {
    expect(evidenceTips("yoga", null, false)).toHaveLength(2);
    expect(evidenceTips("yoga", null, true)).toHaveLength(1);
  });

  it("asks indoors or outdoors only where it changes the tip", () => {
    expect([...ASKS_PLACE].sort()).toEqual(["cycle", "hike", "run", "walk"]);
  });
});
