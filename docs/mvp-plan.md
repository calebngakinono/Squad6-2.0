# MVP plan: Wrench AI, your AI copilot for DIY car repairs

Revised 2026-11-04 (product pivot). Idea presentation: **Friday 2026-11-06**. Deadline: **2026-11-23**.

> YouTube shows you how to fix it. Wrench AI helps you understand what you're watching.

## Problem and hypothesis

People can find repair tutorials, but when a moment is confusing they leave the video and describe what
they saw to another tool, which never saw the video. **Hypothesis:** a video-aware assistant that knows the
repair being shown, the playback moment and the user's vehicle reduces that friction. This is a hypothesis
to validate, not a proven market claim.

## The one demo that matters

Pause a real repair video, ask "what did he just do?", and get an accurate answer grounded in the actual
video, with the timestamp. Real model output, not a script.

## Scope

| Priority | Feature | MVP |
|---|---|---|
| 1 | **Prove video understanding** on authorized, public, embeddable videos | Experiment first (below) |
| 2 | **Repair workspace**: YouTube IFrame player, current timestamp, AI chat, honest status per video | ✅ |
| 3 | **Auth and digital garage**: dark, game-inspired; vPIC year/make/model picker; active vehicle; generic (labelled) vehicle art | ✅ |
| 4 | **Repair missions**: video, questions, timestamp bookmarks, notes, status planned / in progress / completed | ✅ |
| 5 | **Maintenance log** (date, mileage, parts, cost) and light gamification (mission count, milestones) | ✅ lightweight |
| 5 | **General automotive assistant** (no video needed), vehicle-aware, safety rules | ✅ |
| 6 | Polish, tests, production deploy, demo script | ✅ |
| Later | Chrome extension side panel, verified maintenance schedules, photo questions | ❌ |

**Removed from the MVP:** knowledge ingestion, guide authoring and review, component-location database,
hotspot diagrams, guided diagnostics, marketplaces, large analytics dashboards, predictive maintenance,
universal coverage. The previous strategy is kept for reference in `source-strategy.md` (superseded).

## Schedule

| Date | Work | Done when |
|---|---|---|
| **Nov 4** | Plan approved; Gemini key; **video-understanding experiment** | Go/no-go with scored answers, latency and cost per question |
| **Nov 5** | Proof-of-concept workspace: paste URL → embedded player → pause → ask → grounded answer with timestamp (staging) | Works live on 2 chosen videos |
| **Nov 6** | **Idea presentation** (live PoC demo plus slides) | — |
| Nov 7–9 | Workspace for real: video status states, cached video index, chat persistence, provider interface, rate limits and quotas, tests | Analyzed vs not-analyzed vs not-embeddable handled honestly |
| Nov 10–12 | Auth, onboarding (18+ confirmation), garage with vPIC picker, visual identity | Vehicle saved, persists, RLS-tested |
| Nov 13–15 | Missions, bookmarks, notes, mission history | Full mission flow E2E-tested |
| Nov 16–17 | Maintenance log, light gamification, general assistant mode with safety handling | — |
| **Nov 18** | **Feature freeze checkpoint**: cut anything not solid | — |
| Nov 19–21 | Polish, mobile, accessibility, E2E suite, approved production release | Prod live |
| Nov 22–23 | Demo script, README, honest completion report, buffer | Submitted |

**If time runs short, cut in this order:** gamification → maintenance log → general assistant polish. The
video workspace and garage stay.

## First experiment (Priority 1)

Goal: find out whether Gemini can answer timestamp questions about real repair videos accurately enough.

1. **Videos:** 2 public, embeddable repair tutorials, one short (air or cabin filter, about 5–10 min) and one
   longer (front brake pads, about 15–20 min). Prefer videos marked Creative Commons on YouTube.
2. **Script** (`scripts/experiments/`, not app code). For each video:
   - one call to build a video index (summary plus timestamped step list, as JSON);
   - 5 timestamp questions ("What is he doing at 04:32, and why?"), each run both against the whole video and
     against a clip around the timestamp;
   - 2 honesty probes: a question about something not in the video, and one about a moment that isn't there.
3. **Models:** the cheapest capable model against one stronger Flash model. Record latency and token usage.
4. **Scoring:** Caleb watches each moment and marks each answer correct / partial / wrong / hallucinated.
5. **Pass:** ≥ 8 of 10 timestamp answers correct or partial with honest hedging; **zero** confident answers
   on the honesty probes; p50 latency under about 15 s per question; cost per question measured.

**If it fails:** report why, then fall back to (a) clip-only analysis with a narrower window, or (b) a
Creative-Commons video from a source that permits download (e.g. Wikimedia Commons), uploaded through the
Gemini File API and played in our own player. Never by downloading from YouTube.
