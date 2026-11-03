# MVP plan (21-day capstone)

Start: 2026-11-03 · **Deadline: 2026-11-23**

**Goal:** Wrench AI acquires repair knowledge from authorized external sources, reviews it, and serves it
through Quick Lookup, the interactive Repair Studio and Ask Wrench, all from the same approved records.
The demo proves the pipeline end to end on one carefully verified vehicle, and shows how licensed data
sources would scale it. Sources, licensing and costs: [source-strategy.md](source-strategy.md).

## Pilot (decided by source availability)

- **Vehicle:** 2018 Toyota Camry, gasoline. The engine-bay locator covers the 2.5 L A25A-FKS. The hybrid is
  explicitly not supported.
- **Quick Lookup pilot:** engine compartment components, cited to owner's manual OM33B95U p. 432, with hotspots
  on a CC BY-SA 4.0 engine-bay photo.
- **Repair Studio pilot:** cabin air filter replacement, from manual pp. 464–465, corroborated by iFixit #199368.
- **Any vehicle** can be selected (NHTSA vPIC). Wrench shows exactly which features are verified for it.

## Phases

| Days | Phase | Done when |
|---|---|---|
| 1 ✅ | Pipeline: CI, gated deploys, foundation | CI green; deploy workflow merged |
| 2–4 | **1. Auth, design system, app shell, garage** | Sign up and log in; add a vehicle from the vPIC picker; garage persists; guest Quick Lookup page reachable; mobile and desktop polished |
| 5–8 | **2. Knowledge system** | Schema for vehicle configs, components and aliases, locations, procedures and revisions, sources, media and hotspots, review status; license enforcement plus `CONTENT_LICENSE_MODE`; adapters for vPIC, iFixit, YouTube, Commons/Openverse and manual citations; review UI (Draft → Needs review → Approved / Rejected / Superseded); duplicate and contradiction flags; pilot records approved |
| 9–11 | **3. Quick Lookup and visual locator** | Alias and fuzzy search over approved records with timing measured; Quick View and Guided View; reusable hotspot viewer (zoom, keyboard, mobile); honest fallbacks |
| 12–15 | **4. Repair Studio** | Schema-driven engine with all 9 step types; branching; safety gates; progress (local for guests, database for accounts); completion creates a maintenance record; feedback |
| 16–17 | **5. Ask Wrench** | Quick Question and in-guide help, grounded only on approved records with citations; safety screening; limited Guided Diagnosis that escalates when evidence is missing; configurable model provider |
| 18 | **6. Analytics and feedback** | Typed consented events; protected dashboard on real data; feedback per guide revision; retention and deletion |
| 19–21 | **7. Stabilize, deploy, demo** | P0/P1 fixed; full test suite; production release approved; README, demo script, honest completion report |

**If time slips, cut in this order:** Guided Diagnosis depth → revision-comparison analytics → YouTube adapter
→ Openverse discovery (keep Commons by direct file reference).

**Day-16 checkpoint:** decide what is in or out of the demo, based on what actually works.

## Scope rules

- No internet-wide crawler. Adapters fetch specific records on request or from a short list of seeds.
- No invented instructions, locations, diagrams or specs. Where verified data is missing, the UI says so.
- Every displayed fact traces to an approved record with a recorded source and license.
- The capstone runs in `CONTENT_LICENSE_MODE=noncommercial`. Switching to `commercial` must hide all
  noncommercial-only content, and a test proves it.

## Explicitly later

Licensed OEM data (MOTOR or similar), more vehicles and years, contributor photo uploads, photo-based
questions, native apps, full Guided Diagnosis.
