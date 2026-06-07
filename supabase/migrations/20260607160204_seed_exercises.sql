-- ============================================================
-- RepLog — Exercise catalog seed (global, user_id = null)
-- Run AFTER 01_schema.sql.
-- ~36 common hypertrophy exercises, tagged with muscles.
-- Fractional volume: primary 1.0, secondary 0.5.
-- ============================================================

-- 1) Exercises (name, category, is_bodyweight)
insert into exercises (name, category, is_bodyweight) values
  ('Barbell bench press',        'barbell',    false),
  ('Incline dumbbell press',     'dumbbell',   false),
  ('Flat dumbbell press',        'dumbbell',   false),
  ('Cable fly',                  'cable',      false),
  ('Parallel bar dips',          'bodyweight', true),
  ('Machine chest press',        'machine',    false),
  ('Pull-ups',                   'bodyweight', true),
  ('Lat pulldown',               'cable',      false),
  ('Barbell row',                'barbell',    false),
  ('Dumbbell row',               'dumbbell',   false),
  ('Seated cable row',           'cable',      false),
  ('Deadlift',                   'barbell',    false),
  ('Barbell overhead press',     'barbell',    false),
  ('Dumbbell shoulder press',    'dumbbell',   false),
  ('Lateral raises',             'dumbbell',   false),
  ('Front raises',               'dumbbell',   false),
  ('Rear delt fly',              'dumbbell',   false),
  ('Face pull',                  'cable',      false),
  ('Barbell curl',               'barbell',    false),
  ('Dumbbell curl',              'dumbbell',   false),
  ('Hammer curl',                'dumbbell',   false),
  ('Skullcrusher',               'barbell',    false),
  ('Triceps pushdown',           'cable',      false),
  ('Barbell squat',              'barbell',    false),
  ('Leg press',                  'machine',    false),
  ('Leg extension',              'machine',    false),
  ('Lunges',                     'dumbbell',   false),
  ('Hack squat',                 'machine',    false),
  ('Romanian deadlift',          'barbell',    false),
  ('Lying leg curl',             'machine',    false),
  ('Seated leg curl',            'machine',    false),
  ('Hip thrust',                 'barbell',    false),
  ('Standing calf raise',        'machine',    false),
  ('Seated calf raise',          'machine',    false),
  ('Plank',                      'bodyweight', true),
  ('Cable crunch',               'cable',      false),
  ('Hanging leg raise',          'bodyweight', true),
  ('Ab wheel rollout',           'other',      false)
on conflict do nothing;

-- 2) PRIMARY muscle (contribution 1.0)
with m(name, muscle) as (values
  ('Barbell bench press','chest'),
  ('Incline dumbbell press','chest'),
  ('Flat dumbbell press','chest'),
  ('Cable fly','chest'),
  ('Parallel bar dips','chest'),
  ('Machine chest press','chest'),
  ('Pull-ups','back'),
  ('Lat pulldown','back'),
  ('Barbell row','back'),
  ('Dumbbell row','back'),
  ('Seated cable row','back'),
  ('Deadlift','back'),
  ('Barbell overhead press','shoulders'),
  ('Dumbbell shoulder press','shoulders'),
  ('Lateral raises','shoulders'),
  ('Front raises','shoulders'),
  ('Rear delt fly','shoulders'),
  ('Face pull','shoulders'),
  ('Barbell curl','arms'),
  ('Dumbbell curl','arms'),
  ('Hammer curl','arms'),
  ('Skullcrusher','arms'),
  ('Triceps pushdown','arms'),
  ('Barbell squat','quads'),
  ('Leg press','quads'),
  ('Leg extension','quads'),
  ('Lunges','quads'),
  ('Hack squat','quads'),
  ('Romanian deadlift','hamstrings_glutes'),
  ('Lying leg curl','hamstrings_glutes'),
  ('Seated leg curl','hamstrings_glutes'),
  ('Hip thrust','hamstrings_glutes'),
  ('Standing calf raise','calves'),
  ('Seated calf raise','calves'),
  ('Plank','core'),
  ('Cable crunch','core'),
  ('Hanging leg raise','core'),
  ('Ab wheel rollout','core')
)
insert into exercise_muscles (exercise_id, muscle, role, contribution)
select e.id, m.muscle::muscle_enum, 'primary', 1.0
from m join exercises e on e.name = m.name and e.user_id is null
on conflict do nothing;

-- 3) SECONDARY muscles (contribution 0.5)
with s(name, muscle) as (values
  ('Barbell bench press','shoulders'),
  ('Barbell bench press','arms'),
  ('Incline dumbbell press','shoulders'),
  ('Incline dumbbell press','arms'),
  ('Flat dumbbell press','shoulders'),
  ('Flat dumbbell press','arms'),
  ('Parallel bar dips','arms'),
  ('Parallel bar dips','shoulders'),
  ('Machine chest press','arms'),
  ('Pull-ups','arms'),
  ('Lat pulldown','arms'),
  ('Barbell row','arms'),
  ('Dumbbell row','arms'),
  ('Seated cable row','arms'),
  ('Deadlift','hamstrings_glutes'),
  ('Deadlift','quads'),
  ('Barbell overhead press','arms'),
  ('Dumbbell shoulder press','arms'),
  ('Face pull','back'),
  ('Barbell squat','hamstrings_glutes'),
  ('Leg press','hamstrings_glutes'),
  ('Lunges','hamstrings_glutes'),
  ('Hack squat','hamstrings_glutes'),
  ('Romanian deadlift','back')
)
insert into exercise_muscles (exercise_id, muscle, role, contribution)
select e.id, s.muscle::muscle_enum, 'secondary', 0.5
from s join exercises e on e.name = s.name and e.user_id is null
on conflict do nothing;
