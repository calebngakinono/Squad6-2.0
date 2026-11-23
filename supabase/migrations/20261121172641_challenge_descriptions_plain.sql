-- Challenge descriptions in plain words.
--
-- The app's word is "counted workout" (apps/mobile/DESIGN.md, Words: never "accepted workout" in the
-- UI). The weekly-tiers description also listed every level, which the challenge card already shows
-- as rows, so a joined card said everything twice.
--
-- Copy only: no rule, point value, target, cap or config changes. Safe on a database with data.

update public.challenges set
  description = 'The more you train this week, the higher your level. You earn points for your highest level only.'
where id = 'weekly-tiers-v1';

update public.challenges set
  description = 'If at least two thirds of your squad each get 3 counted workouts in this week, everyone who did earns 60 points. Two thirds is rounded up, using the squad as it was when the week started.'
where id = 'squad-week-v1';
