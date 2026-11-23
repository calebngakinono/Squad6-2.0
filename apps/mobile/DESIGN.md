---
name: Squad Six
description: Trail Blaze. Your squad is a trail party; every day trained is a blaze on your tree.
colors:
  forest-night: "#071E15"
  forest-board: "#0F2A1E"
  pine: "#2A3B2D"
  forest: "#284936"
  emerald: "#26604A"
  olive: "#435341"
  sage: "#ADB499"
  bark-line: "#7E8B6B"
  mist: "#EEF0E6"
  sage-paper: "#E8EBDE"
  paper-board: "#F4F6EE"
typography:
  timer:
    fontFamily: "Barlow Condensed"
    fontSize: "76px"
    fontWeight: 600
    lineHeight: "80px"
  display:
    fontFamily: "Barlow Condensed"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: "52px"
  sign:
    fontFamily: "Barlow Condensed"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "34px"
    letterSpacing: "0.6px"
  title:
    fontFamily: "Barlow Condensed"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "36px"
  headline:
    fontFamily: "Barlow Condensed"
    fontSize: "23px"
    fontWeight: 600
    lineHeight: "28px"
  body:
    fontFamily: "Overpass"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "25px"
  label:
    fontFamily: "Overpass"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
  caption:
    fontFamily: "Overpass"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.forest-night}"
    rounded: "{rounded.md}"
    height: "52px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.sage}"
    rounded: "{rounded.md}"
    height: "52px"
  trail-sign:
    backgroundColor: "{colors.forest}"
    textColor: "{colors.mist}"
    rounded: "{rounded.lg}"
    padding: "20px"
  list-group:
    backgroundColor: "{colors.forest-board}"
    textColor: "{colors.mist}"
    rounded: "{rounded.lg}"
---

# Squad Six mobile design system: Trail Blaze

## Overview

**Creative north star: the trail party.** A squad is six people on the same trail. Every day someone
trains is a painted blaze on their tree, and you can see at a glance who has been out this week.
The look is a forest-service trail sign: deep forest ground, olive board edges, sage paint, condensed
routed letters. It should feel like walking into your team's space, not like a settings screen.

Chosen by Caleb on 2026-11-19 from a design round (direction contract: `.impeccable/surfaces/src-app-index-tsx.md`),
built on his pinned palette. It replaces "clean premium" (warm off-white, Inter), which he found plain,
pale and not premium. A Figma designer may replace it later: every value lives in `src/theme/tokens.ts`,
so keep role names and change values.

## Colors

Dark is the home appearance; light is sage paper with forest ink. The app follows the phone setting unless
the person picks Light or Dark in Settings > Appearance (saved on that phone, applied before the splash screen hides).
Read colours with `useTheme().color`; never hard-code one outside `tokens.ts`.

| Role | Dark | Light | Use |
|---|---|---|---|
| `background` | forest night #071E15 | sage paper #E8EBDE | Screen ground. |
| `surface` | forest board #0F2A1E | #F4F6EE | List groups, inputs, cards. |
| `surfaceRaised` | pine #2A3B2D | #FBFCF8 | Above a surface; initials circles. |
| `accent` | sage #ADB499 | emerald #26604A | The one action colour: primary buttons, links, filled blazes, row figures. |
| `accentSoft` | forest #284936 | #D3E0D2 | The trail sign; highlighted rows. `accentSoftPressed` is its pressed state. |
| `signEdge` | bark line #7E8B6B | sage #ADB499 | The trail sign's 1.5pt board edge. (Olive was too close to the board to show.) |
| `text` / `textMuted` | mist #EEF0E6 / sage | forest night / olive #435341 | Reading text / secondary text and hollow blazes. |
| `border` / `borderStrong` | pine / bark line #7E8B6B | #C8CDB6 / #6B775C | Hairlines / control outlines (3:1). |
| `track` | pine | #C8CDB6 | The unfilled part of a progress bar. |
| `success`, `warning`, `danger` (+ `…Soft`) | | | Status only, never decoration. |

`src/theme/tokens.test.ts` checks every text pairing at 4.5:1 and every control outline at 3:1, so a
palette change that breaks contrast fails `pnpm test`.

## Typography

Two families, loaded at runtime in `app/_layout.tsx` (no native rebuild): **Barlow Condensed**, a
routed-sign face, for titles and numbers; **Overpass**, from the highway-sign lineage, for reading text
and controls. Always go through `T` or `useTheme().text(variant)`. Numbers use tabular figures.
Everything follows the iOS text size. The already-large variants stop growing at a cap set in `T`
(`timer` 1.3x, `display` 1.4x, `sign` and `title` 1.5x); reading text is never capped. The timer also stays
on one line and shrinks to fit.

| Variant | Family | Size / line | Weight | Use |
|---|---|---|---|---|
| `timer` | Barlow Condensed | 76 / 80 | 600 | The live workout timer only. |
| `display` | Barlow Condensed | 48 / 52 | 700 | One hero number or statement per screen. |
| `sign` | Barlow Condensed | 32 / 34, caps | 700 | The squad's name on Home. Nothing else. |
| `title` | Barlow Condensed | 32 / 36 | 700 | Screen title; onboarding questions. |
| `headline` | Barlow Condensed | 23 / 28 | 600 | Section heading; the goal line; figures on list rows. |
| `metric` | Barlow Condensed | 30 / 34 | 700 | Numbers in a row of stats. |
| `body` | Overpass | 17 / 25 | 400 | Reading text, row titles. |
| `label` | Overpass | 15 / 20 | 600 | Field labels, card titles. |
| `button` | Overpass | 16 / 20 | 700 | Button text. |
| `small` | Overpass | 14 / 20 | 400 | Secondary lines, helper text. |
| `caption` | Overpass | 12 / 16 | 600 | Data sources, badges, initials. The smallest size. |

## Layout

- Spacing: 4-point scale (`space`: xxs 2, xs 4, sm 8, md 16, lg 24, xl 32, xxl 48, xxxl 64). `layout.gutter`
  24 at the screen edges, `layout.sectionGap` 32 between blocks, `layout.cardPadding` 20.
- One thumb: the screen's main action sits in the `Screen` footer. Everything tappable is at least 48pt.
- Nothing has a fixed height that clips larger text; use `minHeight`. Initials in fixed circles stop
  growing at 1.3x.

### Patterns

- **Screen layout:** every screen is a `Screen` → optional title → blocks separated by `layout.sectionGap`
  → main action in `footer`. A section is a `SectionHeader` plus its content, `layout.headingGap` apart.
- **Lists:** wrap `ListRow`s in a `ListGroup`. Point totals pass `figure` (condensed, in the accent); text values
  (a time zone, "In review") stay `label` in the text colour.
- **Tab bar:** the native iOS tab bar (`app/(tabs)/_layout.tsx`, Liquid Glass on iOS 26), sage tint, SF
  Symbols: Home · Squad · Standings · Challenges · Me. Tasks that need the whole screen or are short detours
  (live workout, Start a workout, past workout, Join, Create squad, Settings) open over the tabs from the
  root Stack. Squad, Standings, Challenges and Me each have their own Stack for the native header.
- **The trail sign** (`features/goals/week-strip.tsx`), top of Home: a forest board with a `signEdge` edge; the
  goal line ("2 of 4 days this week", accent once reached); a hairline; then one column per member on one
  shared baseline: count, blazes (filled from the bottom), initials, name. Yours is brightest (`text`),
  teammates' blazes are `accent`, open seats show two dashed blazes and a dashed circle. No warning colours
  on people; a reached goal is the accent, never a celebration.
- **Home:** squad name as a sign → the trail sign (opens the Squad tab) → captain's Waiting to join → "Invite
  your squad" while there are open seats → **Your season** (`features/progress/season-card.tsx`: points,
  workouts verified or not, goal streak, the last 12 weeks as blazes, next milestone) → Find your squad (no
  squad: after the person's own progress, never instead of it). Footer:
  "<last activity> again" (primary) beside "Other workout" (secondary), or "Start a workout" for someone
  with no workouts yet.
- **Squad tab:** this week (one row per member, blazes as the trailing mark), recent workouts, then members
  (each with their own city, never more precise), the **Home city** card (where the squad ranks this season,
  any change planned for next season; captain: change or cancel the plan), invite code and Leave squad. Without a squad: an `EmptyState` with Join, plus "Start a squad".
- **Me tab:** my workouts, Settings in the header.
- **Challenges:** a card per challenge. Not joined: what it is, the next level, the join note and button.
  Joined: progress `Stat`s first, then the next level ("Next: Silver"); the description and all levels open
  from one ghost toggle.
- **Standings:** Squads | People. Squads rank by their home city, people by their own city; city, country,
  world. Rank as `leading`, points as the row figure, `highlighted` for mine. Someone without a squad opens on People.
- **Workout:** the timer is `T variant="timer"` under a state `Badge`; distance, pace and steps are `Stat`s
  in a `Grid` inside a `Card`, each with its `source`. Footer: `ButtonRow` (Pause/Resume | Finish) and a
  `destructiveGhost` Discard. Once finished and synced, the top of the summary is `FinishTrail`
  (`features/goals/finish-trail.tsx`): the trail sign again, with today's blaze painted in when this workout
  added a new day (compared with the count read before the finish), and one line ("Today's blaze is on your
  trail. Your squad sees it on their Home screen."). Then the `ScoreCard`. No celebration beyond the blaze.
- **Onboarding:** square back button with an olive outline and a thin progress bar at the top (hidden on
  the welcome and the Pro offer), the title, the answer controls, one primary button in the footer,
  disabled until answered. The welcome shows six trails of blazes (yours brightest). Each screen fades in
  once (`motion.duration.slow`).
- **Loading / errors / empty:** `Loading` while waiting; `Notice` with "Try again" next to what failed;
  `EmptyState` when there is nothing yet.

## Elevation & Depth

Dark mode separates layers with surface colour and a hairline, never a shadow. Light mode uses one soft
forest-tinted shadow for raised groups (`elevation.light.raised`). The trail sign always uses its own
`signEdge` edge instead. Apply elevation with `elevationStyle(level, color)` from `src/theme/theme.tsx`.

## Shapes

Small radii, like a routed sign: `radius.sm` 4 (badges, chips, back button, number badges), `md` 6
(buttons, fields), `lg` 8 (cards, list groups, the trail sign), `xl` 16 (sheets). No pill buttons.
Circles are reserved for people (initials). The blaze is the one mark: a small painted rectangle, 2pt
corners, filled or hollow (1.5pt outline).

## Components

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


Button looks: `primary` is a sage fill with forest-night text; `secondary` is transparent with a 1.5pt
`borderStrong` outline and an accent label; `ghost` is an accent label only.

## Do's and Don'ts

- **Do** use the blaze (filled / hollow rectangle) for anything that counts days or steps toward a goal.
- **Do** keep sage for actions and highlights only; status colours only for status.
- **Do** show where every fitness number came from (`Stat` `source`); missing data shows as not recorded.
- **Don't** put a small caps label (kicker) above a heading; the heading speaks for itself.
- **Don't** use gradients, glows, pill buttons or rounded "app" cards; this is a sign, not a bubble.
- **Don't** use warning or danger colours on people (a teammate who hasn't trained is not an alert).

### Words

- **Counted workout**: a workout Squad Six scored and accepted. Never "accepted workout" in the UI.
- **Where a number came from**: "Phone GPS", "Phone step counter", "Squad Six timer", "Synced from Apple
  Health", "Phone GPS or Apple Health", and "Squad Six scoring" for points and counted workouts.
- **Workout outcomes** (`workoutOutcome` in packages/shared, shown by `OutcomeCard`): every finished workout
  has one, so nothing waits on "Scoring…" for more than a minute (then: "hasn't been scored yet" + Try again).
  - **Unverified**: only the timer recorded it. "Saved. It counts for your week." + why + "To earn points next
    time" tips for that activity. It counts for the weekly goal and history, never for points or rankings.
  - **Not scored**: started before points were being awarded ("It started before points were being awarded, so
    it isn't scored"). Only pre-launch test workouts see this.
  - Never punish: a workout that earned nothing still counts for the person's week, and the copy says so first.

## Not done yet

- No icon library; chevrons and check marks are drawn with borders. The tab bar uses SF Symbols (part of
  iOS, no dependency). Other icons wait for the Figma designer.
- The splash screen and Android icon background use #071E15; they change with the next native build.
- Final visuals may come from Figma later. Replace values in `tokens.ts`; keep the role names.
