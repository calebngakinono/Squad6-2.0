# Database schema

Revised 2026-11-04. ✅ migrated · 📝 planned (added in the migration for the feature that needs it).
The migration is the source of truth; columns here are indicative.

| Table | Status | Purpose | Access (RLS) |
|---|---|---|---|
| `profiles` | ✅ | 1:1 with `auth.users`: display name, experience level. Created by the signup trigger. | Owner reads and updates own row |
| `profiles.adult_confirmed_at` | 📝 | 18+ confirmation (the Gemini API terms require adult users) | Owner |
| `vehicles` | 📝 | A user's car: year, make, model, optional trim/engine, nickname, mileage, vPIC make/model ids, `is_active` | Owner |
| `videos` | 📝 | One row per YouTube video id: title, channel, duration, `status` (see architecture.md), `analysis jsonb` (summary plus timestamped steps), model, analyzed_at, error | Read: signed in. Write: server only |
| `missions` | 📝 | A repair attempt: vehicle, title, video, `status` planned / in_progress / completed, completed_at, notes | Owner |
| `mission_messages` | 📝 | Chat: role, content, `video_time_s`, `grounding` video_grounded / general, created_at | Owner (via mission) |
| `bookmarks` | 📝 | Mission timestamp bookmarks: `time_s`, label, note | Owner (via mission) |
| `maintenance_records` | 📝 | Vehicle, optional mission, service date, mileage, title, parts (text), `cost_cents`, notes | Owner |
| `ai_usage` | 📝 | User, kind (index / moment / general), model, input and output tokens, latency, created_at. Used for quotas and cost monitoring | Insert: server. Read: owner's own rows |

## Rules for every migration

1. Create the table, enable RLS and add policies **in the same migration**.
2. Add a pgTAP test for each policy (allowed and denied).
3. Additive and safe on a populated database. Never edit a merged migration (the CI guard enforces this).
4. Functions use `set search_path = ''`; `security definer` only when needed.
5. Money is integer cents, times are `timestamptz`, video positions are seconds, ids are `uuid`.
6. After schema changes, run `pnpm db:types` and commit the generated types.
