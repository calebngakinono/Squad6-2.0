# Data integrity and privacy rules

Mandatory for anything that touches workouts, metrics, points, location or anything the app tells a user
about their fitness. Squad Six only works if people trust the standings and trust us with their data.

## 1. Never fabricate fitness data

- Show only metrics that were actually measured or entered. If a metric is unavailable, show nothing or say
  "not available", never a placeholder number.
- Every metric carries a **source** (gps, healthkit, health_connect, ble_hr, pedometer, manual) and a
  **provenance**: `live`, `synced` (arrived after the workout), `manual` or `estimated`.
- Manual and estimated values are labeled in the UI. Estimated calories are never shown as sensor data.
- Insights, trends and analytics (including Pro) are computed from recorded data only. With too little data,
  say so ("Log 3 more workouts to see your weekly trend"). No generic filler insights.
- Demo, onboarding and marketing content uses obviously fictional people and is labeled "Demo".

## 2. Points are earned, not claimed

- The server calculates every award from the session, its evidence and the active scoring-rule version.
- One session can be awarded once. Corrections are reversing ledger rows with a reason.
- Evidence can add a small verification bonus, judged by data quality and independent evidence categories,
  never by device brand. Every activity must have a realistic phone-only path to most of that bonus.
- Performance rewards validated, activity-specific measurements. It never rewards calories, heart rate above
  safe zones, or duration beyond the cap.
- No pay-to-win: Pro never changes points, eligibility or rankings.
- Sponsored challenges, if added later, stay outside competitive points.
- No uncapped duration rewards and no calorie-based rankings. Caps exist partly to avoid rewarding overtraining.

## 3. Location

- Precise coordinates and GPS routes are visible to their owner only. Teammates, feeds and leaderboards show
  city at most.
- Location is collected only during a workout that uses it, and only with permission.

## 4. Health data

- Read health-platform data only after the user grants permission, only the types the feature needs, and only
  for the purpose shown in the permission prompt.
- Apple and Google restrict how health data may be used (no advertising, no selling). Follow their current
  rules before shipping any health integration.
- Measurements (weight, height etc.) are optional and owner-only.

## 5. Prizes and rewards

- Physical prizes and drawings are planned, not promised. Copy must not imply they exist at launch.
- Drawings give Pro members no extra entries and need a free entry method and published official rules.
- No prize campaign goes live without funding, eligibility rules and legal review, approved by Caleb.

## 6. Account deletion

- Users can delete their account in the app. Deletion removes their personal data and auth user. Ledger rows
  that affect other people's standings are anonymized, not left pointing at a person.
