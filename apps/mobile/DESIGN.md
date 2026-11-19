# Squad Six mobile design system

The look is **clean premium**: warm neutral backgrounds, one deep green accent, a calm sans-serif,
plenty of space. It should feel like a premium wellness app, not a neon gym app. Light and dark mode
are equal; the app follows the phone setting.

All values live in `src/theme/tokens.ts`. A designer can change the whole look by editing that one
file. Components and screens never hard-code a color, size, radius, shadow or font.

## Principles

1. **One thumb.** Design for one-handed use. The main action of a screen sits at the bottom in the
   `Screen` footer. Every tappable thing is at least 48pt tall (`minTouch`).
2. **One accent.** Green is for primary actions, selection and links. Do not use it for decoration.
   Use the status colors (success, warning, danger) only for status.
3. **Quiet surfaces.** Separate layers with space first, then surface color. In light mode a raised
   card has a soft shadow; in dark mode it has a lighter surface and a hairline. Never both.
4. **Considered numbers.** Timers, points, distances and ranks use tabular figures (`numeric`, or the
   `display`/`metric` variants) so digits do not jump. Every fitness number says where it came from
   (`Stat`'s `source`, see `docs/data-integrity.md`).
5. **Text that scales.** Nothing has a fixed height that would clip larger text. Use `minHeight`.
6. **Readable in both modes.** Body text is at least 4.5:1 against its background, large text and
   control outlines at least 3:1. `src/theme/tokens.test.ts` checks every pairing below, so a palette
   change that breaks contrast fails `pnpm test`.

## Tokens (`src/theme/tokens.ts`)

### Color roles (`palette.light` / `palette.dark`)

| Role | Use |
|---|---|
| `background` | Screen background (warm paper / warm near-black). |
| `surface` | Cards, inputs, list groups. |
| `surfaceRaised` | Above a surface: segmented thumb, sheets. |
| `surfaceSunken` | Recessed wells: segmented track, `Card variant="sunken"`, neutral badge. |
| `surfacePressed` | Pressed state of rows, secondary and ghost buttons. |
| `text` / `textMuted` | Main and secondary text. `textMuted` also for placeholders. |
| `border` | Hairlines and dividers (decorative). |
| `borderStrong` | Outlines that define a control (text fields, unselected pills). |
| `accent` / `accentPressed` / `onAccent` | Primary action fill, its pressed state, and text on it. |
| `accentSoft` | Tinted background for highlighted things; put `accent` text on it. |
| `success`, `warning`, `danger` (+ `…Soft`) | Status text, and soft backgrounds for badges. |
| `dangerPressed` / `onDanger` | Destructive button. |
| `focus` | Focused text field outline. |
| `scrim` | Dims content behind a sheet or dialog. |

Read colors with `useTheme().color` (or the older `usePalette()`, which returns the same object).

### Type (`type`)

One family, Inter, loaded at runtime in `app/_layout.tsx` (no native rebuild). If it fails to load,
the same sizes and weights render in the system font. Always go through `T` or `useTheme().text(variant)`;
using `type.x` directly in a style gets the system font.

| Variant | Size / line | Weight | Use |
|---|---|---|---|
| `timer` | 64 / 72 | 600, tabular | The live workout timer only: read at arm's length, mid-run. |
| `display` | 44 / 52 | 600, tabular | One hero number per screen (season total, a workout's points). |
| `title` | 30 / 36 | 600 | Screen title. |
| `headline` | 20 / 26 | 600 | Section heading, empty-state title. |
| `metric` | 28 / 34 | 600, tabular | Numbers in a row of stats. |
| `body` | 17 / 25 | 400 | Reading text, row titles. |
| `label` | 15 / 20 | 500 | Field labels, card titles. |
| `button` | 16 / 20 | 600 | Button text. |
| `small` | 14 / 20 | 400 | Secondary lines, helper text. |
| `caption` | 12 / 16 | 500 | Data sources, footnotes, badges. Smallest size in the app. |

### Space, shape, elevation, motion

- `space`: `xxs 2, xs 4, sm 8, md 16, lg 24, xl 32, xxl 48, xxxl 64`.
- `layout`: `gutter` (screen side padding, 24), `sectionGap` (between blocks, 32), `cardPadding` (20),
  `stackGap` (inside a card, 16), `headingGap` (a `SectionHeader` to the list or card it introduces, 12).
- `radius`: `sm 8, md 12` (controls), `lg 16` (cards), `xl 24` (sheets), `pill`.
- `size`: `control 52` (buttons, fields), `controlCompact 40` (pills, padded to 48 with hitSlop),
  `row 56`, `chevron`, `leading 32` (rank column in a row), `tile 96` (activity tiles), `mark 22` /
  `markDot 10` (radio and checkbox marks).
- `monoFamily`: monospace, for raw diagnostic output only (the dev device-check report). Never UI text.
- `borderWidth`: `thin 1`, `thick 2`.
- `elevation`: `flat`, `raised`, `overlay`, `thumb`, each with a `shadow` (light) or `outline` (dark).
  Apply with `elevationStyle(level, color)` from `src/theme/theme.tsx`.
- `state`: `disabledOpacity`, `pressedScale`.
- `motion.duration`: `instant 90, fast 150, base 220, slow 320` ms. Motion is short and ease-out.
  Anything that slides or scales more than a press must respect Reduce Motion.

## Components (`src/components/`)

Import each from its own file, e.g. `import { Button } from "@/components/button"`.

| Component | When to use | Key props |
|---|---|---|
| `Screen` (`screen.tsx`) | The frame of every screen: background, safe areas, scroll, keyboard, bottom action area. | `footer` (pinned primary actions), `header` (true when the native header is shown), `scroll`, `refreshControl`, `contentStyle` |
| `T` (`screen-text.tsx`) | All text. | `variant`, `tone` (`text`, `textMuted`, `accent`, `success`, `warning`, `danger`, `onAccent`), `numeric`, `align` |
| `Button` | Any action. One `primary` per screen, ideally in the footer. `destructiveGhost` is the quiet way into a destructive flow that a confirmation then guards (discard workout, leave squad, delete account, remove a set); `destructive` is a filled final step. | `label`, `onPress`, `variant` (`primary`, `secondary`, `ghost`, `destructive`, `destructiveGhost`), `busy`, `disabled` |
| `ButtonRow` | Two (at most three) related buttons sharing one row: Pause / Finish, Decline / Approve, Back / Next. | children |
| `Card` | A group of related content. Never nest cards. | `variant` (`raised` default, `outlined`, `sunken`) |
| `TextField` | Text input with a visible label. | `label`, `helper`, `error`, plus all `TextInput` props |
| `Segmented` | 2–4 options that switch a whole view (season, scope). | `label`, `options`, `value`, `onChange` |
| `Pill` (`badge.tsx`) | Selectable chips from a short set (activity, goal). | `label`, `selected`, `onPress` |
| `Badge` (`badge.tsx`) | One- or two-word status ("You", "Captain", "Verified", "Pending"). | `label`, `tone` |
| `ListRow` | One line in a list: members, standings, history, settings. | `title`, `subtitle`, `leading`, `trailing`, `value` (tabular), `onPress`, `chevron`, `highlighted`, `divider`, `titleLines` |
| `ListGroup` | A raised, rounded group of `ListRow`s (iOS inset-grouped list). Rows run edge to edge, dividers start at the text, the last divider is dropped automatically, and a `highlighted` row is tinted. | children (`ListRow`s, may be conditional) |
| `Stat` | A number with its label and source. `splitUnit("5.24 km")` splits a formatted value so the unit is set smaller. | `value`, `label`, `unit`, `source`, `size` (`regular`, `large`), `align` |
| `Grid` / `GridCell` (`grid.tsx`) | Two-column wrapping layout for `Tile`s, or `Stat`s wrapped in `GridCell`. | `gap` (`sm`, `lg`) |
| `Tile` | A large tappable card in a grid that starts something (activity picker). | `title`, `caption`, `onPress` |
| `Choice` | A full-width answer row with a radio or checkbox mark (onboarding questions, time zone). | `label`, `selected`, `onPress`, `radio` |
| `SectionHeader` | Heading for a group within a screen; `level="screen"` for the title of a screen without a native header (home), with its action on the right. | `title`, `subtitle`, `action`, `level` |
| `Notice` | An inline message next to what it is about: a failed load (with "Try again"), a saved setting, a GPS caveat. Announced to screen readers. | `message`, `tone` (`danger` default, `success`, `warning`, `info`), `action` |
| `Loading` | The one loading look: muted spinner with a line saying what is loading. | `label`, `fill` |
| `Progress` | Where someone is in a short sequence of in-app steps (onboarding). Never for fitness goals or estimates. | `value`, `total`, `label` |
| `EmptyState` | Content that does not exist yet. Says what is missing and what to do. Never filler data. | `title`, `message`, `action` |
| `CityPicker` | Choosing a city from the server's list. | `label`, `value`, `onChange` |

Feature-level pieces built from these: `ScoreCard` (`features/workout/score-card.tsx`, the server's score for
one workout, used by the live summary and past workouts) and `SquadPanel` (`features/squads/squad-panel.tsx`).

### Patterns

- **Screen layout:** every screen is a `Screen` (no bare `SafeAreaView`/`ScrollView`) → optional title →
  blocks separated by `layout.sectionGap` (automatic) → main action in `footer`. A section is a
  `SectionHeader` plus its content, `layout.headingGap` apart.
- **Lists:** wrap `ListRow`s in a `ListGroup`. Inside a `Card` (mixed content) set `divider={false}` on
  the last row yourself.
- **This week strip** (`features/goals/week-strip.tsx`): top of Home. Six seats (you first in the accent,
  teammates on `surfaceSunken`, `accentSoft` once they reach their goal, dashed open seats), one pip per goal
  day under each. No warning colors on people; a reached goal is the accent, never a celebration.
- **Home:** in reading order: title row (squad name + Settings) → the this-week strip (primary) → what needs
  action (no squad: Find your squad; captain: Waiting to join) → one `ListGroup` of destinations, the first
  being Squad standings with my season points as its value → squad management (members, invite code, leave).
  A new destination (e.g. Challenges) is one more `ListRow` in that group. The footer holds the workout
  action (start, or return to the one in progress).
- **Standings:** `ListRow` in a `ListGroup` with the rank as `leading` (`<T numeric tone="textMuted">`),
  points as `value`, and `highlighted` for the athlete's own squad.
- **Workout:** the timer is `T variant="timer"` under a state `Badge`; distance, pace and steps are
  `Stat`s in a `Grid` inside a `Card`, each with `source` ("Phone GPS", "Phone step counter",
  "Synced from Apple Health"). Footer: `ButtonRow` (Pause/Resume | Finish) and a `destructiveGhost` Discard.
- **Onboarding** (`app/onboarding.tsx`, `features/onboarding/layouts.tsx`): back chevron and a thin
  progress bar at the top (hidden on the welcome and the Pro offer), the title (`display` on statement
  screens, `title` on questions), the answer controls, and one primary button in the footer that stays
  disabled until the question is answered. Each screen fades in once (`motion.duration.slow`). The
  six-seat row (you filled, five teammates soft) is the only picture. Days-a-week questions use the
  number-key grid with the chosen number shown large.
- **Loading / errors / empty:** `Loading` while waiting; `Notice` (with a "Try again" action when a load
  failed) next to what failed, naming the problem and the fix; `EmptyState` when there is nothing yet.

## Words

- **Counted workout**: a workout Squad Six scored and accepted (not discarded, expired, rejected or waiting for
  review). Never "accepted workout" in the UI.
- **Where a number came from** (`Stat` `source`): "Phone GPS", "Phone step counter", "Squad Six timer",
  "Synced from Apple Health", "Phone GPS or Apple Health", and "Squad Six scoring" for points and counted
  workouts. No "calculated / scored / awarded by" variants.
- **Not scored yet**: say when points appear ("Points show here once it's scored"), never that scoring is
  switched off, launching, or done "by the server".

## Not done yet

- No icon library. Rows draw their chevron, and `Choice` its check mark, with borders. If icons are needed, add `expo-symbols`
  (SF Symbols on iOS) with `npx expo install`; it needs a new development build.
- The splash screen and Android icon background in `app.json` use `#1F6F4A`; the refined accent is
  `#1D6A46`. Update them with the next native build.
- Final visuals come from Figma later. Replace values in `tokens.ts`; keep the role names.
