> **Superseded on 2026-11-04 by the product pivot** (see `mvp-plan.md`). Kept for reference: the vPIC,
> YouTube and licensing findings still apply; the guide and knowledge-ingestion plan does not.

# Source strategy

Researched 2026-11-03. Wrench AI gets repair knowledge from external, authorized sources and turns it into
reviewed records. Nobody on the team photographs or repairs vehicles to create content.

**Rule zero:** finding something online does not give us permission to reproduce it. Every source has a
recorded license, and the app enforces it (see "License enforcement" below). This document is engineering
guidance, not legal advice. Re-check terms before any commercial launch.

## Source evaluation

| Source | What it gives us | Cost | License / restrictions | Decision |
|---|---|---|---|---|
| **NHTSA vPIC** (`vpic.nhtsa.dot.gov/api`) | Makes, models, years, VIN decoding | Free, no key | US government data | ✅ **Vehicle identification only.** Never a source of repair instructions. |
| **NHTSA Recalls API** (`api.nhtsa.gov/recalls`) | Open recalls per make/model/year (e.g. 8 for a 2018 Camry) | Free, no key | US government data | ✅ Optional safety banner in My Garage. Low effort. |
| **Manufacturer owner's manuals** (e.g. Toyota hosts PDFs publicly) | Authoritative component locations and DIY procedures | Free to read | Copyrighted. We may **cite** them (manual code and page) and write our own instructions from them. We may **not** copy their text or illustrations. | ✅ **Primary authority** for what they cover. |
| **iFixit API** (`ifixit.com/api/2.0`) | Community repair guides with steps, photos and parts | Free API | **CC BY-NC-SA 3.0**: noncommercial use only, attribution, share-alike. iFixit's terms prohibit training ML/AI models on its data. Commercial licenses: legal@ifixit.com (no published price). | ⚠️ **Corroborating source and capstone visuals only.** Stored with `commercial_use = false`. Never used for model training. |
| **YouTube Data API v3** | Finding instructional videos | Free within quota (10,000 units/day; one search ≈ 100 units) | Official IFrame embed only; no downloading or rehosting. Stored API data must be refreshed or deleted within about 30 days; keep YouTube branding intact. | ✅ **Discovery and embed.** Shown as "community video, not verified by Wrench". |
| **Wikimedia Commons / Openverse** (`api.openverse.org`) | Openly licensed photos (CC0, CC BY, CC BY-SA) | Free | Attribution required; CC BY-SA requires sharing adaptations under the same license. Commercial use is allowed. | ✅ **Main path for reusable photos.** Our SVG annotations go on top. |
| **MOTOR DaaS** (also ALLDATA, Mitchell 1, HaynesPro) | OEM procedures, component locations, diagrams | Quote-only enterprise licensing; no public pricing | Commercial license | ❌ Not for the capstone. ✅ The realistic path to broad coverage later. The adapter interface is designed for it. |
| **CarMD API** | Maintenance schedules, repair cost estimates | Paid credits (small free tier reported, unverified) | Commercial terms | ⏸ Deferred. |
| **Websites, forums, dealer blogs** | Lots of content | — | Copyrighted; terms usually forbid scraping or reuse | ❌ Not ingested. A reviewer may read one, but it is never a cited authority. |

## Paths to reusable visual assets

1. **Openly licensed photos and original SVG overlays (now, $0, commercial-safe).** The photo comes from
   Commons or Openverse. Hotspots, labels and highlights are our own SVG layer, stored as data. Attribution is
   shown in the UI. Annotated composites of CC BY-SA photos are released as CC BY-SA.
2. **iFixit step photos (capstone only, $0).** Attributed, flagged noncommercial, and removable in a single
   switch (see below).
3. **Original schematic illustrations (anytime).** Simple SVG diagrams drawn by us and verified against the
   cited source, for example "filter cover clips". They are never traced from copyrighted illustrations.
4. **Later, for scale.** Licensed OEM diagrams through a data provider. Or a contributor program: users
   upload their own photos under a contributor agreement, and every upload goes through the same review
   workflow.

## Coverage check for the candidate vehicles

Probed the real APIs on 2026-11-03:

| Vehicle | iFixit guides found | Openly licensed photos | Owner's manual coverage |
|---|---|---|---|
| **2018 Toyota Camry** | Engine air filter (#186001: 6 steps, **0 photos**, video-based); **Cabin air filter (#199368: 6 steps, 9 photos)** | **Engine bay, XV70 2.5 L, CC BY-SA 4.0, 3560×2670**; hybrid engine bay CC0 (different layout); interior CC BY-SA (glove box not visible) | Manual OM33B95U (Aug 2017, A25A-FKS 2.5 L and 2GR-FKS 3.5 L): **engine compartment diagram, p. 432**; **air conditioning (cabin) filter procedure, pp. 464–465**; no engine air filter procedure |
| 2018 Honda Civic | Engine air filter (#167874: 13 steps, 37 photos) | Only a Chinese-market 1.5 T engine photo; the US 2.0 L LX differs | Not checked further |
| 2017 Nissan Rogue | Engine air filter (#200001: 10 steps, 20 photos, flagged "Markup Mishap") | None found | Not checked further |

## Recommendation: 2018 Toyota Camry (gasoline), two pilot experiences on one source set

**Quick Lookup pilot:** engine compartment components on the 2.5 L (A25A-FKS): fuse box, engine oil filler cap,
oil dipstick, brake fluid reservoir, battery, radiator, coolant reservoir and washer fluid tank. Each location
cites the owner's manual (OM33B95U p. 432). Hotspots go on the CC BY-SA engine-bay photo. All of this is
commercially reusable. The hybrid is explicitly excluded because its engine bay layout differs (visible in the
CC0 photo).

**Repair Studio pilot: cabin air filter replacement.** The procedure is written in our own words from the
owner's manual (pp. 464–465) and corroborated by iFixit #199368. It shows off safety (engine off), visual
identification (glove box, filter cover claws), a branch ("foreign objects on top of the filter?"), and a
completion check ("UP" arrow orientation, from the manual). Visuals are iFixit photos (noncommercial,
capstone only) plus original SVG schematics as the commercial-safe replacement.

**Why not the engine air filter:** the 2018 Camry manual has no engine air filter procedure, and its engine
diagram does not label the air cleaner. The only step-by-step sources are noncommercial or unverified video.
We would have no authoritative source to verify against.

Applicability starts as **2018 model year only**. 2019–2024 can be added after their manuals are checked.
Each year is a separate verified applicability, never assumed.

## How one record set powers all three features

```
vehicle_config  2018 Toyota Camry · gasoline · 2.5L A25A-FKS        (vPIC make/model ids)
component       cabin_air_filter   aliases: "cabin filter", "AC filter", "pollen filter",
                                            "air conditioning filter"
source          S1 Toyota OM33B95U pp.464–465 · copyrighted, cite-only · commercial_use: cite-only
                S2 iFixit #199368 · CC BY-NC-SA 3.0 · commercial_use: false
                S3 Commons "Toyota Camry Engine IMG 20180408 152456" · CC BY-SA 4.0 · commercial_use: true
component_location  cabin_air_filter @ 2018 Camry: "behind the glove box" · sources [S1, S2] · approved
procedure_revision  "Replace the cabin air filter" v1 · steps[] · sources [S1, S2] · approved
   step 3  type: visual_identification → references component_location + media hotspot
   step 4  type: decision "Debris on top of the filter?" → branch
```

- **Quick Lookup:** "where is the AC filter?" → alias → component → approved location for the selected
  vehicle → Quick View card with citations and a link to the procedure.
- **Repair Studio:** renders the approved procedure revision. Its visual steps point at the same location
  and hotspot records.
- **Ask Wrench:** retrieves the same approved records, answers only from them, and cites S1/S2.

Fix a record once and all three features update. Nothing reaches users unless its status is `approved`.

## License enforcement (built in Phase 2)

- Each source and media asset stores: license code, commercial use (`allowed` / `cite-only` / `false`),
  attribution text, share-alike flag, terms URL, retrieved date.
- A deployment setting `CONTENT_LICENSE_MODE`, either `noncommercial` (capstone) or `commercial`. In
  `commercial` mode, the queries behind Quick Lookup, Repair Studio and Ask Wrench automatically exclude
  any record or image that depends on `commercial_use = false`. One switch, tested.
- Attribution is rendered wherever licensed media appears.
- Content from sources whose terms forbid AI training is never used to train or fine-tune models.
  Retrieval at answer time is allowed only where the license permits that use.

## Broad vehicle selection, honest support

Users can pick any make, model and year from vPIC. For each one, Wrench shows exactly what is verified:
"Supported: cabin air filter, engine-bay locator" versus "No verified repair data yet". Unsupported vehicles
still get useful, non-invented help: open recalls (NHTSA), a link to the manufacturer's owner manual site,
and YouTube videos clearly labelled unverified.

## Costs

| Item | Capstone | Notes |
|---|---|---|
| vPIC, NHTSA recalls, Commons, Openverse, owner's manuals | $0 | |
| iFixit API | $0 | Noncommercial only |
| YouTube Data API | $0 | Within the default quota |
| Railway | about $5–20/month | Hobby plan plus usage (estimate) |
| Supabase | $0, or $25/month for Pro | Pro only if a third active project is needed |
| AI model API | about $5–25 total | Development and demo usage (estimate; depends on model choice) |
| **Later, commercial** | Quote-based | iFixit commercial license, MOTOR DaaS (or similar), optional commissioned illustrations |

## Risks

| Risk | Mitigation |
|---|---|
| iFixit visuals can't be used commercially | Flagged, excluded by `CONTENT_LICENSE_MODE=commercial`; SVG schematics as the replacement |
| A photo's market differs from the US vehicle | The reviewer checks it against the manual diagram before any hotspot is approved; applicability is limited to what was checked |
| YouTube data retention rules | Store only video IDs and minimal metadata with a `refreshed_at`; scheduled refresh or delete within 30 days |
| Wrong hotspot placement | Hotspots have their own review status; nothing renders as "verified" until a reviewer approves the placement |
| Coverage looks thin | The demo is honest about verified scope; the architecture shows how licensed data scales it |
