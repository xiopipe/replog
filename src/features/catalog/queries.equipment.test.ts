// queries.ts imports generateId from the @/db barrel, which chains to the whole
// data layer (supabase → react-native) at load time. The jest env is pure-logic
// only, so stub the barrel down to the one value queries.ts needs. The pure
// selector under test uses no @/db runtime value, only types (erased).
jest.mock('@/db', () => ({ generateId: () => 'test-id' }));

import { getFilteredExercises } from './queries';
import type { ExerciseRow, ExerciseMuscleRow } from '@/db';

function ex(id: string, name: string, category: ExerciseRow['category']): ExerciseRow {
  return {
    id,
    user_id: null,
    name,
    category,
    is_custom: false,
    is_bodyweight: category === 'bodyweight',
    instructions: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
  };
}

function muscle(id: string, exercise_id: string, m: ExerciseMuscleRow['muscle']): ExerciseMuscleRow {
  return {
    id,
    exercise_id,
    muscle: m,
    role: 'primary',
    contribution: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

const exercises = {
  a: ex('a', 'Bench Press', 'barbell'),
  b: ex('b', 'Dumbbell Curl', 'dumbbell'),
  c: ex('c', 'Push-up', 'bodyweight'),
};
const muscles = {
  ma: muscle('ma', 'a', 'chest'),
  mb: muscle('mb', 'b', 'arms'),
  mc: muscle('mc', 'c', 'chest'),
};

describe('getFilteredExercises — equipment filter (TKT-0037)', () => {
  it('filters by equipment category', () => {
    const r = getFilteredExercises(exercises, {}, muscles, {}, '', null, 'barbell');
    expect(r.map((e) => e.id)).toEqual(['a']);
  });

  it('ANDs equipment with muscle filter', () => {
    // chest + bodyweight → only the push-up, not the barbell bench press
    const r = getFilteredExercises(exercises, {}, muscles, {}, '', 'chest', 'bodyweight');
    expect(r.map((e) => e.id)).toEqual(['c']);
  });

  it('returns all when equipment filter is null (back-compat)', () => {
    const r = getFilteredExercises(exercises, {}, muscles, {}, '', null);
    expect(r.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
  });
});
