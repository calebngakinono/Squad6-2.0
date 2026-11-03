#!/usr/bin/env bash
# Guards supabase/migrations against the two ways a migration hurts a live database:
#   1. Editing a migration that already ran somewhere (staging/prod never re-run it, so they drift).
#   2. Data-destroying SQL slipping in unnoticed.
# A new migration that must destroy data needs a line `-- destructive-ok: <reason>`,
# which makes the intent explicit in review.
#
# Usage: scripts/check-migrations.sh <base-ref>   (e.g. origin/dev)
set -euo pipefail

base="${1:?usage: check-migrations.sh <base-ref>}"
dir="supabase/migrations"
status=0

while IFS=$'\t' read -r change path; do
  [ -z "${change:-}" ] && continue
  if [ "$change" != "A" ]; then
    echo "::error file=$path::Existing migration changed ($change). Never edit or remove a merged migration; add a new one."
    status=1
    continue
  fi
  if grep -qiE '^[[:space:]]*--[[:space:]]*destructive-ok:' "$path"; then
    echo "Note: $path is marked destructive-ok; review it carefully."
    continue
  fi
  # Strip comments, then look for statements that delete data.
  hits=$(sed -E 's/--.*$//' "$path" | grep -niE '\b(drop[[:space:]]+(table|column|schema)|truncate|delete[[:space:]]+from)\b' || true)
  if [ -n "$hits" ]; then
    echo "::error file=$path::Possibly destructive SQL. Make it additive, or add '-- destructive-ok: <reason>' after review."
    echo "$hits"
    status=1
  fi
done < <(git diff --name-status --no-renames "$base"...HEAD -- "$dir" | sed -E 's/^([A-Z])[0-9]*/\1/')

[ "$status" -eq 0 ] && echo "Migration guard: OK"
exit "$status"
