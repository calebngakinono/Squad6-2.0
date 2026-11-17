import type { GpsSummary } from "./gps-summary";
import type { HealthKitResult } from "./healthkit-check";

// Plain-text report the tester shares back. Contains no coordinates, only summaries.
export type DeviceCheckReport = {
  platform: string;
  generatedAt: string;
  location: { foreground: string; background: string; summary: GpsSummary | null };
  motion: { available: boolean | null; permission: string; stepsDuringTest: number | null; stepsLastHour: number | null };
  healthKit: HealthKitResult | null;
};

const n = (v: number | null, digits = 0) => (v === null ? "n/a" : v.toFixed(digits));

export function formatReport(r: DeviceCheckReport): string {
  const s = r.location.summary;
  const lines = [
    "Squad Six device check",
    `Platform: ${r.platform}`,
    `Generated: ${r.generatedAt}`,
    "",
    "GPS",
    `  Permission: foreground ${r.location.foreground}, background ${r.location.background}`,
  ];
  if (s) {
    lines.push(
      `  Points: ${s.points} (${s.backgroundPoints} while in background)`,
      `  Duration: ${n(s.durationSec)} s, ${n(s.pointsPerMinute, 1)} points/min, longest gap ${n(s.longestGapSec)} s`,
      `  Median accuracy: ${n(s.medianAccuracyM, 1)} m`,
      `  Distance: ${n(s.distanceM)} m, fastest segment ${n(s.maxSegmentSpeedMs, 1)} m/s`,
      `  Mocked points: ${s.mockedPoints}`,
    );
  } else {
    lines.push("  Not run");
  }
  lines.push(
    "",
    "Motion",
    `  Pedometer available: ${r.motion.available ?? "not checked"}, permission ${r.motion.permission}`,
    `  Steps during GPS test: ${r.motion.stepsDuringTest ?? "n/a"}`,
    `  Steps in last hour (iOS): ${r.motion.stepsLastHour ?? "n/a"}`,
    "",
    "Apple Health",
  );
  const hk = r.healthKit;
  if (!hk) lines.push("  Not run");
  else if (hk.status === "unavailable") lines.push("  HealthKit not available on this device");
  else if (hk.status === "error") lines.push(`  Error: ${hk.message}`);
  else {
    lines.push(`  Workouts in last 30 days (max 10): ${hk.workouts.length}`);
    for (const w of hk.workouts) {
      lines.push(
        `  - ${w.activity}, ${w.start} (${w.durationMin} min), distance ${w.distance ?? "none"}, ` +
          `source ${w.source} [${w.bundleId}], device ${w.device ?? "unknown"}, entered by hand: ${w.userEntered}`,
      );
    }
    const hr = hk.latestWorkoutHeartRate;
    lines.push(
      hr
        ? `  Heart rate in latest workout: ${hr.samples} samples, min ${hr.min} / avg ${hr.avg} / max ${hr.max} bpm`
        : "  Heart rate in latest workout: no samples (none recorded, or read access denied: iOS doesn't say which)",
    );
  }
  return lines.join("\n");
}
