import { formatWeight } from './weight-format';

const base = { weight_value: null, weight_unit: null, weight_kg: null } as const;

describe('formatWeight (TKT-0005)', () => {
  it('shows what the user typed with its own unit', () => {
    expect(formatWeight({ ...base, weight_value: 100, weight_unit: 'lb' }, 'kg')).toBe('100 lb');
  });

  it('falls back to the profile unit when weight_unit is null', () => {
    expect(formatWeight({ ...base, weight_value: 60, weight_unit: null }, 'lb')).toBe('60 lb');
  });

  it('converts canonical kg into the user unit instead of hardcoding kg', () => {
    expect(formatWeight({ ...base, weight_kg: 100 }, 'lb')).toBe('220.46 lb');
    expect(formatWeight({ ...base, weight_kg: 100 }, 'kg')).toBe('100 kg');
  });

  it('shows a dash when there is no weight at all', () => {
    expect(formatWeight(base, 'kg')).toBe('—');
  });
});
