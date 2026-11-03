# Database schema

Status key: ✅ migrated · 📝 planned (added in the migration for the feature that needs it).
Column lists are indicative; the migration is the source of truth.

## Users

| Table | Status | Purpose | Access (RLS) |
|---|---|---|---|
| `profiles` | ✅ | 1:1 with `auth.users`; display name, experience level. Created by signup trigger. | Owner reads/updates own row. No client inserts. |
| `profiles.role` | 📝 | `user` / `editor` / `admin` for the content workflow. | Only admins change roles. |
| `profiles.analytics_consent`, `consented_at` | 📝 | Consent for product analytics. | Owner. |

## Vehicles and garage

| Table | Status | Purpose | Access |
|---|---|---|---|
| `vehicles` | 📝 | Canonical catalog: year, make, model, trim, engine. | Public read; editors write. |
| `garage_vehicles` | 📝 | A user's vehicle: `vehicle_id`, nickname, mileage. | Owner only. |

## Verified content (Knowledge Engine)

| Table | Status | Purpose | Access |
|---|---|---|---|
| `sources` | 📝 | Where information came from: title, publisher, URL, license type, license notes, retrieved date. | Editors. |
| `repairs` | 📝 | Repair types (e.g. engine air filter replacement), category, slug. | Public read. |
| `guides` | 📝 | One guide per repair × vehicle applicability set; points at its current verified revision. | Public read when it has a verified revision. |
| `guide_revisions` | 📝 | Versioned guide JSON (`content jsonb`), `status` (`draft` → `in_review` → `verified` → `retired`), author, verifier, verified_at, change notes. Immutable once verified. | Public read of `verified`; editors otherwise. |
| `guide_applicability` | 📝 | Which `vehicles` a revision applies to. | Same as revision. |
| `guide_revision_sources` | 📝 | Sources backing a revision, with locator (page/section). Steps cite these by id. | Same as revision. |
| `part_locations` | 📝 | Quick Lookup answers: vehicle, part, location description, diagram, sources, verification status. | Public read of verified. |
| `media_assets` | 📝 | Images/diagrams in Supabase Storage with alt text, hotspot coordinates, source and license. | Public read of verified. |

## User activity

| Table | Status | Purpose | Access |
|---|---|---|---|
| `repair_sessions` | 📝 | Saved progress: user, guide revision, garage vehicle, current step, branch choices, checklist state, started/completed. | Owner. |
| `maintenance_records` | 📝 | Date, mileage, title, parts, cost (cents), notes, optional `repair_session_id`. | Owner. |
| `repair_feedback` | 📝 | Outcome, difficulty, time taken, comments per completed session. | Owner writes; editors read aggregated. |
| `analytics_events` | 📝 | `event_name`, `properties jsonb`, user or anonymous id, timestamp. Written only with consent. | Insert-only from server; no client reads. |
| `assistant_conversations` / `assistant_messages` | 📝 | AI chat history with cited revision/source ids. | Owner. |

## Rules for every migration

1. Create the table, enable RLS and add policies **in the same migration**.
2. Add a pgTAP test in `supabase/tests/` for each new policy (allowed and denied cases).
3. Migrations must be **additive and safe on a populated database**: add nullable columns or columns with
   defaults; backfill in a separate step; drop or rename only in a later release after code stops using it.
4. Never edit a migration that has reached `dev`. Write a new one.
5. Functions use `set search_path = ''`; `security definer` only when needed, with fully qualified names.
6. Money is integer cents. Times are `timestamptz`. IDs are `uuid`.
7. After schema changes run `pnpm db:types` and commit the generated types.
