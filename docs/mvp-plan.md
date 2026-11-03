# MVP plan (21-day capstone)

Start: 2026-11-03 · Target: 2026-11-23

**Goal:** one polished, fully verified repair journey — find it in Quick Lookup, follow it in the
interactive Repair Studio, finish it and log it — that works reliably on a phone. Coverage expands only
after that works.

## Launch combination

**Decision needed from Caleb.** Pick one vehicle and one repair:

- Vehicles: 2017 Nissan Rogue, 2018 Toyota Camry, 2018 Honda Civic
- Repairs: engine air filter, cabin air filter, windshield wipers

Recommendation: whichever vehicle you can **physically photograph and walk through**, with an
**engine air filter** replacement. It is low-risk, needs few or no tools, and has a clear "find the
airbox, open the clips, swap the filter" flow that shows off hotspots, a branch and a safety gate.
Your own photos also solve image licensing.

## Schedule

| Days | Focus | Done when |
|---|---|---|
| 1–2 | Foundation (this PR), deploy pipeline | CI green; staging deploys; production gated on approval |
| 3–4 | Content model: `vehicles`, `repairs`, `guides`, `guide_revisions`, `sources`, `media_assets`; guide Zod schema | Schema + RLS tests; one draft guide stored as JSON |
| 5–6 | Author and verify the launch guide; capture photos and hotspots | Guide passes the verification checklist |
| 7–9 | **Quick Lookup**: vehicle picker, search, Quick View / Guided View | Anonymous user finds the guide in < 3 taps on mobile |
| 10–13 | **Repair Studio**: step renderer, hotspot viewer, tool checklist, safety gate, branching, completion | Full guide works end to end; E2E test covers it |
| 14–15 | Auth, onboarding, **My Garage**, saved progress | Signed-in user resumes a repair on another device |
| 16 | Maintenance log + create record from a completed repair | E2E covers it |
| 17–18 | **AI Quick Question** grounded on the verified guide with citations and refusal | Answers cite the guide; refuses unverified questions |
| 19 | Post-repair feedback + consent-based analytics events | Events recorded only with consent |
| 20–21 | Polish, accessibility, performance, demo script, production release | Approved production deploy |

## Explicitly later

Guided Diagnosis, automated source ingestion, more vehicles and repairs, admin editing UI beyond
what the launch guide needs, native apps.
