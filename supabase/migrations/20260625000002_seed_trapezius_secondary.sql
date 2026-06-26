-- TKT-0003: Add trapezius (back) secondary muscle for heavy back lifts.
--
-- The 8-group muscle enum does not have a 'trapezius' value — the back group
-- already covers it. This migration adds 'back' as a SECONDARY muscle for
-- compound back exercises where the trapezius is significantly recruited but
-- was missing from the seed, causing under-counted back volume in those
-- sessions. ON CONFLICT DO NOTHING makes this fully idempotent.

with s(name, muscle) as (values
  ('Barbell row',       'back'),
  ('Dumbbell row',      'back'),
  ('Seated cable row',  'back'),
  ('Deadlift',          'back'),
  ('Romanian deadlift', 'back')
)
insert into exercise_muscles (exercise_id, muscle, role, contribution)
select e.id, s.muscle::muscle_enum, 'secondary', 0.5
from s
join exercises e on e.name = s.name and e.user_id is null
on conflict do nothing;
