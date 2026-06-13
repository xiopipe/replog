/**
 * Starter templates — hardcoded in code (not DB seeded).
 *
 * Exercises are referenced by name matching the global catalog seed exactly
 * (see docs/specs/sql/02_seed_exercises.sql). At clone time, names not found in
 * globalExercises$ are skipped with a console.warn.
 *
 * Weekdays: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday.
 *
 * Target summary display rules (see routine_editor.ts):
 *   target_sets + reps_min == reps_max → "X series · Y reps"
 *   target_sets + reps_min < reps_max  → "X series · Y–Z reps"
 *   target_sets + no reps              → "X series · al fallo"
 */

import type { Template } from './mutations';

// ---------------------------------------------------------------------------
// Full body 3 días
// Mon / Wed / Fri — same structure, three "Full body" routines
// ---------------------------------------------------------------------------

const FULLBODY_EXERCISES = [
  { exerciseName: 'Barbell squat',           orderIndex: 0, target_sets: 4, target_reps_min: 6,  target_reps_max: 8  },
  { exerciseName: 'Barbell bench press',     orderIndex: 1, target_sets: 4, target_reps_min: 6,  target_reps_max: 10 },
  { exerciseName: 'Barbell row',             orderIndex: 2, target_sets: 4, target_reps_min: 6,  target_reps_max: 10 },
  { exerciseName: 'Barbell overhead press',  orderIndex: 3, target_sets: 3, target_reps_min: 8,  target_reps_max: 12 },
  { exerciseName: 'Romanian deadlift',       orderIndex: 4, target_sets: 3, target_reps_min: 10, target_reps_max: 12 },
  { exerciseName: 'Plank',                   orderIndex: 5, target_sets: 3, target_reps_min: null, target_reps_max: null },
];

export const TEMPLATE_FULLBODY: Template = {
  planName: 'Full body 3 días',
  routines: [
    { name: 'Full body A', weekday: 0, exercises: FULLBODY_EXERCISES }, // Monday
    { name: 'Full body B', weekday: 2, exercises: FULLBODY_EXERCISES }, // Wednesday
    { name: 'Full body C', weekday: 4, exercises: FULLBODY_EXERCISES }, // Friday
  ],
};

// ---------------------------------------------------------------------------
// Upper / Lower — 4 days: Mon Upper / Tue Lower / Thu Upper / Fri Lower
// ---------------------------------------------------------------------------

export const TEMPLATE_UPPER_LOWER: Template = {
  planName: 'Upper / Lower',
  routines: [
    {
      name: 'Upper A',
      weekday: 0, // Monday
      exercises: [
        { exerciseName: 'Barbell bench press',     orderIndex: 0, target_sets: 4, target_reps_min: 6,  target_reps_max: 10 },
        { exerciseName: 'Barbell row',             orderIndex: 1, target_sets: 4, target_reps_min: 6,  target_reps_max: 10 },
        { exerciseName: 'Barbell overhead press',  orderIndex: 2, target_sets: 3, target_reps_min: 8,  target_reps_max: 12 },
        { exerciseName: 'Lat pulldown',            orderIndex: 3, target_sets: 3, target_reps_min: 10, target_reps_max: 12 },
        { exerciseName: 'Barbell curl',            orderIndex: 4, target_sets: 3, target_reps_min: 10, target_reps_max: 15 },
        { exerciseName: 'Triceps pushdown',        orderIndex: 5, target_sets: 3, target_reps_min: 10, target_reps_max: 15 },
      ],
    },
    {
      name: 'Lower A',
      weekday: 1, // Tuesday
      exercises: [
        { exerciseName: 'Barbell squat',    orderIndex: 0, target_sets: 4, target_reps_min: 6,  target_reps_max: 8  },
        { exerciseName: 'Romanian deadlift',orderIndex: 1, target_sets: 3, target_reps_min: 10, target_reps_max: 12 },
        { exerciseName: 'Leg press',        orderIndex: 2, target_sets: 3, target_reps_min: 10, target_reps_max: 15 },
        { exerciseName: 'Leg extension',    orderIndex: 3, target_sets: 3, target_reps_min: 12, target_reps_max: 15 },
        { exerciseName: 'Lying leg curl',   orderIndex: 4, target_sets: 3, target_reps_min: 12, target_reps_max: 15 },
        { exerciseName: 'Standing calf raise', orderIndex: 5, target_sets: 4, target_reps_min: 12, target_reps_max: 20 },
      ],
    },
    {
      name: 'Upper B',
      weekday: 3, // Thursday
      exercises: [
        { exerciseName: 'Incline dumbbell press',   orderIndex: 0, target_sets: 4, target_reps_min: 8,  target_reps_max: 12 },
        { exerciseName: 'Seated cable row',          orderIndex: 1, target_sets: 4, target_reps_min: 8,  target_reps_max: 12 },
        { exerciseName: 'Dumbbell shoulder press',   orderIndex: 2, target_sets: 3, target_reps_min: 10, target_reps_max: 12 },
        { exerciseName: 'Pull-ups',                  orderIndex: 3, target_sets: 3, target_reps_min: null, target_reps_max: null },
        { exerciseName: 'Dumbbell curl',             orderIndex: 4, target_sets: 3, target_reps_min: 10, target_reps_max: 15 },
        { exerciseName: 'Skullcrusher',              orderIndex: 5, target_sets: 3, target_reps_min: 10, target_reps_max: 15 },
      ],
    },
    {
      name: 'Lower B',
      weekday: 4, // Friday
      exercises: [
        { exerciseName: 'Deadlift',             orderIndex: 0, target_sets: 4, target_reps_min: 4,  target_reps_max: 6  },
        { exerciseName: 'Hack squat',           orderIndex: 1, target_sets: 3, target_reps_min: 10, target_reps_max: 12 },
        { exerciseName: 'Lunges',               orderIndex: 2, target_sets: 3, target_reps_min: 10, target_reps_max: 12 },
        { exerciseName: 'Seated leg curl',      orderIndex: 3, target_sets: 3, target_reps_min: 12, target_reps_max: 15 },
        { exerciseName: 'Hip thrust',           orderIndex: 4, target_sets: 3, target_reps_min: 10, target_reps_max: 15 },
        { exerciseName: 'Seated calf raise',    orderIndex: 5, target_sets: 4, target_reps_min: 15, target_reps_max: 20 },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// PPL — Push / Pull / Legs × 2 — Mon Push / Tue Pull / Wed Legs / Thu Push / Fri Pull / Sat Legs
// ---------------------------------------------------------------------------

const PUSH_A = [
  { exerciseName: 'Barbell bench press',    orderIndex: 0, target_sets: 4, target_reps_min: 6,  target_reps_max: 10 },
  { exerciseName: 'Incline dumbbell press', orderIndex: 1, target_sets: 3, target_reps_min: 10, target_reps_max: 12 },
  { exerciseName: 'Barbell overhead press', orderIndex: 2, target_sets: 3, target_reps_min: 8,  target_reps_max: 12 },
  { exerciseName: 'Lateral raises',         orderIndex: 3, target_sets: 4, target_reps_min: 15, target_reps_max: 20 },
  { exerciseName: 'Triceps pushdown',       orderIndex: 4, target_sets: 3, target_reps_min: 12, target_reps_max: 15 },
  { exerciseName: 'Skullcrusher',           orderIndex: 5, target_sets: 3, target_reps_min: 10, target_reps_max: 12 },
];

const PULL_A = [
  { exerciseName: 'Deadlift',              orderIndex: 0, target_sets: 4, target_reps_min: 4,  target_reps_max: 6  },
  { exerciseName: 'Barbell row',           orderIndex: 1, target_sets: 4, target_reps_min: 6,  target_reps_max: 10 },
  { exerciseName: 'Lat pulldown',          orderIndex: 2, target_sets: 3, target_reps_min: 10, target_reps_max: 12 },
  { exerciseName: 'Seated cable row',      orderIndex: 3, target_sets: 3, target_reps_min: 10, target_reps_max: 12 },
  { exerciseName: 'Face pull',             orderIndex: 4, target_sets: 3, target_reps_min: 15, target_reps_max: 20 },
  { exerciseName: 'Barbell curl',          orderIndex: 5, target_sets: 3, target_reps_min: 10, target_reps_max: 15 },
  { exerciseName: 'Hammer curl',           orderIndex: 6, target_sets: 3, target_reps_min: 10, target_reps_max: 15 },
];

const LEGS_A = [
  { exerciseName: 'Barbell squat',       orderIndex: 0, target_sets: 4, target_reps_min: 6,  target_reps_max: 10 },
  { exerciseName: 'Romanian deadlift',   orderIndex: 1, target_sets: 4, target_reps_min: 10, target_reps_max: 12 },
  { exerciseName: 'Leg press',           orderIndex: 2, target_sets: 3, target_reps_min: 10, target_reps_max: 15 },
  { exerciseName: 'Leg extension',       orderIndex: 3, target_sets: 3, target_reps_min: 12, target_reps_max: 15 },
  { exerciseName: 'Lying leg curl',      orderIndex: 4, target_sets: 3, target_reps_min: 12, target_reps_max: 15 },
  { exerciseName: 'Standing calf raise', orderIndex: 5, target_sets: 4, target_reps_min: 15, target_reps_max: 20 },
];

export const TEMPLATE_PPL: Template = {
  planName: 'PPL (Push / Pull / Legs)',
  routines: [
    { name: 'Push A',  weekday: 0, exercises: PUSH_A }, // Monday
    { name: 'Pull A',  weekday: 1, exercises: PULL_A }, // Tuesday
    { name: 'Legs A',  weekday: 2, exercises: LEGS_A }, // Wednesday
    { name: 'Push B',  weekday: 3, exercises: PUSH_A }, // Thursday (same structure)
    { name: 'Pull B',  weekday: 4, exercises: PULL_A }, // Friday
    { name: 'Legs B',  weekday: 5, exercises: LEGS_A }, // Saturday
  ],
};

// ---------------------------------------------------------------------------
// Blank — the "En blanco" option creates an empty active plan with no routines.
// The UI handles this by calling createPlan() with no exercises.
// Export a sentinel so the template picker can distinguish it.
// ---------------------------------------------------------------------------

export const TEMPLATE_BLANK = null;

// ---------------------------------------------------------------------------
// All templates (ordered as displayed in the picker)
// ---------------------------------------------------------------------------

export interface TemplateConfig {
  id: string;
  /** i18n key for name (templates.xxx) */
  nameKey: string;
  /** i18n key for description (templates.xxx_desc) */
  descKey: string;
  /** null = blank (no routines); Template object = clone routines */
  template: Template | null;
}

export const ALL_TEMPLATES: TemplateConfig[] = [
  {
    id: 'fullbody',
    nameKey: 'templates.fullbody',
    descKey: 'templates.fullbody_desc',
    template: TEMPLATE_FULLBODY,
  },
  {
    id: 'upper_lower',
    nameKey: 'templates.upper_lower',
    descKey: 'templates.upper_lower_desc',
    template: TEMPLATE_UPPER_LOWER,
  },
  {
    id: 'ppl',
    nameKey: 'templates.ppl',
    descKey: 'templates.ppl_desc',
    template: TEMPLATE_PPL,
  },
  {
    id: 'blank',
    nameKey: 'templates.blank',
    descKey: 'templates.blank_desc',
    template: TEMPLATE_BLANK,
  },
];
