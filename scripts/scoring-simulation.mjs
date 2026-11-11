// Scoring-model SIMULATION for docs/scoring-proposal.md. Research script, not app code.
// Values are PROPOSED and unapproved. The production engine will live in Postgres.
//
//   node scripts/scoring-simulation.mjs
//
// Change a number in RULES, re-run, and every scenario and season estimate updates.

const RULES = {
  version: "v1",
  base: 170,
  verification: { 0: 0, 1: 15, 2: 25, 3: 30 }, // by count of independent sensor categories
    minActiveMin: { default: 20, hiit: 15 },
  mergeGapMin: 120, // a session starting sooner than this after the previous one ends is merged
  daily: [1.0, 0.5], // 1st scored workout 100 %, 2nd 50 %, 3rd+ recorded with 0 points
};

const ramp = (x, lo, hi) => Math.max(0, Math.min(1, (x - lo) / (hi - lo)));

// Performance = Effort (0-30, identical for every activity) + Intensity (0-20, activity-specific).
// Effort: active minutes, 20 → 60 min, nothing beyond 60 (no reward for excessive duration).
// Intensity: only validated measurements. Distance needs a GPS track or an auto-recorded platform
// workout. "Vigorous minutes" come from HR (77-95 % of estimated max; time above 95 % never counts)
// OR from motion intensity, so it is not wearable-only. Every intensity ramp is capped.
const EFFORT_MAX = 30;
const INTENSITY_MAX = 20;
const effort = (w) => ramp(Math.min(w.activeMin, 60), 20, 60);
const pace = (w) => w.activeMin / w.distanceKm; // min per km
const INTENSITY = {
  run: (w) => (w.distanceKm >= 2 ? ramp(8.0 - pace(w), 0, 3.5) : 0), // 8:00 → 4:30 min/km
  walk: (w) => (w.distanceKm ? ramp(((w.distanceKm + (w.elevationM ?? 0) / 100) / w.activeMin) * 60, 4, 7) : 0), // effort-km/h, 100 m climb ≈ 1 km
  cycle: (w) => (w.distanceKm ? ramp((w.distanceKm / w.activeMin) * 60, 15, 32) : 0), // km/h
  swim: (w) => (w.distanceM ? ramp(3.5 - w.activeMin / (w.distanceM / 100), 0, 1.75) : 0), // 3:30 → 1:45 per 100 m
  strength: (w) => ramp(w.workingSets ?? 0, 8, 24), // sets logged live, plausible spacing
  indoorCardio: (w) => ramp(w.vigorousMin ?? 0, 5, 25),
  yoga: (w) => ramp(w.vigorousMin ?? 0, 5, 25),
  hiit: (w) => ramp(w.vigorousMin ?? 0, 5, 25),
};
const PERFORMANCE = (w) => EFFORT_MAX * effort(w) + INTENSITY_MAX * INTENSITY[w.activity](w);

// Decision for Caleb: a live, server-timestamped set log counts as one evidence category for strength.
const STRUCTURED_LOG_COUNTS = true;

const SENSOR_CATEGORIES = ["location", "motion", "heartRate", "platformRecord", "visual"];

function evaluate(w) {
  const reasons = [];
  if (w.plausibilityFailed) return { status: "needs_review", total: 0, reasons: [w.plausibilityFailed] };
  const min = RULES.minActiveMin[w.activity] ?? RULES.minActiveMin.default;
  if (w.activeMin < min) return { status: "recorded", total: 0, reasons: [`active ${w.activeMin} min < ${min} min minimum`] };

  const signals = SENSOR_CATEGORIES.filter((c) => w.signals?.[c]);
  if (STRUCTURED_LOG_COUNTS && w.liveStructuredLog) signals.push("liveSetLog");
  const corroborated = signals.length > 0 || w.liveStructuredLog;
  if (!corroborated) return { status: "recorded", total: 0, reasons: ["timer only: no corroborating evidence"] };

  const verification = RULES.verification[Math.min(3, signals.length)];
  const performance = Math.round(PERFORMANCE(w));
  return {
    status: "accepted",
    base: RULES.base,
    verification,
    performance,
    total: RULES.base + verification + performance,
    signals,
    reasons,
  };
}

// Daily rules: merge back-to-back sessions, then apply the 100 % / 50 % / 0 schedule.
function scoreDay(sessions) {
  const merged = [];
  for (const s of [...sessions].sort((a, b) => a.startMin - b.startMin)) {
    const prev = merged.at(-1);
    if (prev && s.startMin - (prev.startMin + prev.elapsedMin) < RULES.mergeGapMin && s.activity === prev.activity) {
      prev.activeMin += s.activeMin;
      prev.elapsedMin = s.startMin + s.elapsedMin - prev.startMin;
      if (s.distanceKm != null) prev.distanceKm = (prev.distanceKm ?? 0) + s.distanceKm;
      prev.mergedCount = (prev.mergedCount ?? 1) + 1;
    } else merged.push({ ...s });
  }
  let rank = 0;
  return merged.map((s) => {
    const r = evaluate(s);
    if (r.status !== "accepted") return { ...s, ...r };
    const factor = RULES.daily[rank++] ?? 0;
    return {
      ...s,
      ...r,
      factor,
      total: Math.round(r.total * factor),
      status: factor === 0 ? "recorded" : "accepted",
    };
  });
}

const phone = { location: true, motion: true };
const watch = { heartRate: true, platformRecord: true, motion: true };

const SCENARIOS = [
  ["1 Phone-only 5 km run, 30 min", { activity: "run", activeMin: 30, distanceKm: 5, signals: phone }],
  ["1b Fast runner, phone-only 10 km in 42 min", { activity: "run", activeMin: 42, distanceKm: 10, signals: phone }],
  ["2 Apple Watch 10 km run, 55 min (+ phone GPS)", { activity: "run", activeMin: 55, distanceKm: 10, signals: { ...watch, location: true } }],
  ["3 Treadmill 40 min, phone in pocket, 15 vigorous min (motion)", { activity: "indoorCardio", activeMin: 40, vigorousMin: 15, signals: { motion: true } }],
  ["4 Phone-only strength, 50 min, 16 sets logged live", { activity: "strength", activeMin: 50, workingSets: 16, liveStructuredLog: true, signals: {} }],
  ["4b Strength with $40 Bluetooth HR strap, 50 min, 16 sets", { activity: "strength", activeMin: 50, workingSets: 16, liveStructuredLog: true, signals: { heartRate: true } }],
  ["5 Watch strength, 60 min, 20 sets", { activity: "strength", activeMin: 60, workingSets: 20, liveStructuredLog: true, signals: watch }],
  ["6 Yoga 45 min, phone timer only", { activity: "yoga", activeMin: 45, signals: {} }],
  ["7 Yoga 60 min with watch, 6 vigorous min", { activity: "yoga", activeMin: 60, vigorousMin: 6, signals: watch }],
  ["7b Yoga 60 min, phone in pocket (motion only)", { activity: "yoga", activeMin: 60, signals: { motion: true } }],
  ["8 Phone-only 25 km ride, 60 min", { activity: "cycle", activeMin: 60, distanceKm: 25, signals: phone }],
  ["9 Phone-only brisk walk 3 km, 30 min", { activity: "walk", activeMin: 30, distanceKm: 3, signals: phone }],
  ["10 Hike 8 km + 400 m climb, 150 min, phone", { activity: "walk", activeMin: 150, distanceKm: 8, elevationM: 400, signals: phone }],
  ["11 Watch pool swim 1,500 m, 40 min", { activity: "swim", activeMin: 40, distanceM: 1500, signals: watch }],
  ["12 HIIT class 35 min, watch, 15 vigorous min", { activity: "hiit", activeMin: 35, vigorousMin: 15, signals: watch }],
  ["12b Same HIIT class, phone in pocket, 12 vigorous min (motion)", { activity: "hiit", activeMin: 35, vigorousMin: 12, signals: { motion: true } }],
  ["13 Beginner: phone-only 22 min walk, 1.8 km", { activity: "walk", activeMin: 22, distanceKm: 1.8, signals: phone }],
  ["14 ABUSE: 8 h timer, phone on a desk", { activity: "run", activeMin: 480, signals: {} }],
  ["15 ABUSE: 'run' at 38 km/h avg (car)", { activity: "run", activeMin: 30, distanceKm: 19, signals: phone, plausibilityFailed: "average speed 38 km/h is not a run" }],
  ["16 ABUSE: hand-typed Health app run (user-entered record rejected)", { activity: "run", activeMin: 50, signals: { platformRecord: false } }],
];

const pad = (s, n) => String(s).padEnd(n);
console.log(`Rules ${RULES.version}: base ${RULES.base}, verification ${JSON.stringify(RULES.verification)}, performance 0-${EFFORT_MAX + INTENSITY_MAX} (effort ${EFFORT_MAX} + intensity ${INTENSITY_MAX})\n`);
console.log(pad("Scenario", 50), pad("Status", 13), pad("Base", 5), pad("Verif", 6), pad("Perf", 5), "Total  Signals / reason");
for (const [name, w] of SCENARIOS) {
  const r = evaluate(w);
  console.log(
    pad(name, 50),
    pad(r.status, 13),
    pad(r.base ?? "-", 5),
    pad(r.verification ?? "-", 6),
    pad(r.performance ?? "-", 5),
    pad(r.total, 6),
    r.status === "accepted" ? r.signals.join("+") : r.reasons.join("; "),
  );
}

console.log("\nDaily rules");
const DAYS = [
  ["A Two-a-day: 07:00 run 6 km/35 min (phone) + 18:00 strength 45 min/14 sets (phone)", [
    { activity: "run", startMin: 420, elapsedMin: 38, activeMin: 35, distanceKm: 6, signals: phone },
    { activity: "strength", startMin: 1080, elapsedMin: 50, activeMin: 45, workingSets: 14, liveStructuredLog: true, signals: {} },
  ]],
  ["B ABUSE: one 60 min run split into 3 x 20 min sessions, 2 min apart", [
    { activity: "run", startMin: 420, elapsedMin: 20, activeMin: 20, distanceKm: 3.5, signals: phone },
    { activity: "run", startMin: 442, elapsedMin: 20, activeMin: 20, distanceKm: 3.5, signals: phone },
    { activity: "run", startMin: 464, elapsedMin: 20, activeMin: 20, distanceKm: 3.5, signals: phone },
  ]],
  ["C ABUSE: four 25 min walks spread through the day", [0, 1, 2, 3].map((i) => (
    { activity: "walk", startMin: 480 + i * 180, elapsedMin: 25, activeMin: 25, distanceKm: 2.2, signals: phone }
  ))],
];
for (const [name, sessions] of DAYS) {
  const results = scoreDay(sessions);
  const total = results.reduce((t, r) => t + r.total, 0);
  console.log(`\n${name}\n  -> day total ${total}`);
  for (const r of results)
    console.log(`     ${pad(r.activity, 9)} ${pad(r.activeMin + " min", 8)} ${pad(r.mergedCount ? `(merged x${r.mergedCount})` : "", 13)} ${pad(r.status, 10)} ${r.total}${r.factor != null ? `  (x${r.factor})` : ""}`);
}

console.log("\nSeason estimates (regular workouts only, 52 weeks)");
const PROFILES = [
  ["Casual: 3/week, phone-only, avg perf 22", 3, 170 + 25 + 22],
  ["Regular: 4/week, phone-only, avg perf 32", 4, 170 + 25 + 32],
  ["Regular: 4/week, watch, avg perf 32", 4, 170 + 30 + 32],
  ["Committed: 5/week, watch, avg perf 40", 5, 170 + 30 + 40],
  ["Elite: 6/week + 3 two-a-days, avg perf 45", 6, 170 + 30 + 45, 3],
];
for (const [name, perWeek, avg, twoADays = 0] of PROFILES) {
  const week = perWeek * avg + twoADays * Math.round(avg * RULES.daily[1]);
  console.log(`  ${pad(name, 46)} ${pad(week + "/wk", 9)} ${(week * 52).toLocaleString("en-US")}/season`);
}
