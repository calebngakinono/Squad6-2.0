# Content verification rules

Wrench AI tells people how to work on cars. Wrong information can damage a vehicle or hurt someone.
These rules apply to guides, Quick Lookup answers, diagrams, seed data, UI copy and AI output.

## 1. Allowed sources

Information may come only from sources we are permitted to use:

- Licensed repair data or APIs (under their license terms)
- Manufacturer owner's manuals and documentation used within their terms
- Material we create ourselves by performing and photographing the repair
- Other sources whose license or written permission allows our use

Not allowed: indiscriminate scraping, copying forum posts or videos, or republishing copyrighted text
or images without permission. When the license is unclear, the source is not used.

Every source is recorded in `sources` with publisher, URL or reference, license type, license notes and
retrieval date.

## 2. Safety-critical facts need a citation

These must cite a specific source (with page or section) and can never be estimated, inferred or generated:

- Torque values, fluid types and capacities, part numbers, filter or wiper sizes
- Lift and jack points, battery and electrical disconnect steps, airbag or hot-surface warnings
- Any step where a mistake could cause injury or damage

If we do not have a verified value, the guide says so and points to the owner's manual. It does not guess.

## 3. Lifecycle

```
draft ──► in_review ──► verified ──► retired
  ▲            │
  └── changes ─┘
```

- **draft**: anyone with the editor role can write. Not visible to users.
- **in_review**: a different person than the author checks it against the checklist below.
- **verified**: visible to users. The revision becomes immutable. Fixes create a new revision.
- **retired**: replaced or withdrawn; kept for history, because user progress and records point to it.

For the capstone, Caleb is the verifier. The app records `verified_by` and `verified_at`.

## 4. Verification checklist

- [ ] Vehicle applicability is exact (year, model, trim or engine where it matters)
- [ ] Every safety-critical fact has a citation that was actually opened and checked
- [ ] Every image or diagram is ours or licensed, has alt text, and hotspots point at the right part
- [ ] Tools and parts lists are complete; safety gates sit before the steps they protect
- [ ] Branches (e.g. "clips or screws?") lead somewhere valid; no dead ends
- [ ] Wording works for a beginner (Guided View) and is fast for a pro (Quick View)
- [ ] Ideally the repair was walked through on a real vehicle or against a verified reference

## 5. AI assistant rules

- Answers come only from **verified** revisions, part locations and their sources, retrieved for the
  user's vehicle. Every answer cites what it used.
- If nothing verified covers the question, the assistant says it does not have verified information,
  and may offer general safety advice and suggest the owner's manual or a professional.
- It never produces specs, part numbers or step-by-step procedures from its own model knowledge.
- Guided Diagnosis suggests likely causes and next checks; it does not present a diagnosis as certain,
  and it escalates to a professional for brakes, steering, airbags, fuel leaks and similar.
- AI output is never written into guide content automatically. Ingestion may *draft*; a human verifies.

## 6. Tests and seed data

Seed data and test fixtures use obviously fake values (e.g. "Test Vehicle 2000", "10 Nm (fixture)") unless
they copy a verified revision. Never put realistic-looking but unverified specs in fixtures.
