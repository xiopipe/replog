import { abbreviateRoutine, routineColorMap } from './routine-label';

describe('abbreviateRoutine (TKT-0054)', () => {
  it('uses initials for multi-word names, capped at 3', () => {
    expect(abbreviateRoutine('Full Body A')).toBe('FBA');
    expect(abbreviateRoutine('Tren Superior')).toBe('TS');
  });

  it('uses the first two letters for single-word names', () => {
    expect(abbreviateRoutine('Empuje')).toBe('Em');
    expect(abbreviateRoutine('Tirón')).toBe('Ti');
    expect(abbreviateRoutine('Pierna')).toBe('Pi');
    // English Push/Pull collide on two letters — color disambiguates them.
    expect(abbreviateRoutine('Push')).toBe('Pu');
    expect(abbreviateRoutine('Pull')).toBe('Pu');
  });

  it('returns the full name uppercased when it is 2 chars or fewer', () => {
    expect(abbreviateRoutine('A')).toBe('A');
    expect(abbreviateRoutine('AB')).toBe('AB');
  });
});

describe('routineColorMap (TKT-0054)', () => {
  const palette = ['#a', '#b', '#c'] as const;

  it('assigns a stable distinct color per routine, independent of order/repeats', () => {
    const m1 = routineColorMap(['r2', 'r1', 'r2', 'r1'], palette);
    const m2 = routineColorMap(['r1', 'r2'], palette);
    expect(m1).toEqual(m2); // sorted ids → stable assignment
    expect(m1.r1).not.toBe(m1.r2);
  });

  it('wraps around when there are more routines than colors', () => {
    const m = routineColorMap(['r1', 'r2', 'r3', 'r4'], palette);
    expect(m.r4).toBe(m.r1); // 4th wraps to palette[0]
  });
});
