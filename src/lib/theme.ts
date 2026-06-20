// RepLog design tokens — dark by default (gym environment).
// Source: skill `rn-screen-patterns`. Light ramp included for future use.

export const palette = {
  // Brand / semantic
  accent: '#2F6FB0',
  success: '#1D9E75',
  warning: '#85500B',
  warningBg: '#FAEEDA',
  error: '#A32D2D',
  // Muscle figure
  musclePrimary: '#D85A30',
  muscleSecondary: '#F0997B',
  // PR chip
  prIconBg: '#F6D99A',
  prText: '#9A7322',
  prBorder: '#EDD99A',
  // Overlays
  overlay: 'rgba(0,0,0,0.5)',
  shadow: '#000000',
} as const;

export const dark = {
  ...palette,
  background: '#121417',
  surface: '#1B1F24',
  surfaceAlt: '#232A31',
  border: '#2C343C',
  textPrimary: '#F2F4F6',
  textSecondary: '#A8B0B8',
  textTertiary: '#6E767E',
  onAccent: '#FFFFFF',
} as const;

export const light = {
  ...palette,
  background: '#FFFFFF',
  surface: '#F5F6F8',
  surfaceAlt: '#ECEFF2',
  border: '#D8DCE0',
  textPrimary: '#14181C',
  textSecondary: '#4C545C',
  textTertiary: '#828A92',
  onAccent: '#FFFFFF',
} as const;

// MVP defaults to dark.
export const colors = dark;

/**
 * Categorical colors for distinguishing routines at a glance (e.g. the weekly
 * strip, TKT-0054). Stable, distinct hues that read on the dark surface.
 */
export const routinePalette = [
  '#2F6FB0', // blue (accent)
  '#1D9E75', // green
  '#C9772E', // amber
  '#8E6FCB', // purple
  '#C2506E', // pink
  '#3E9E9E', // teal
] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  md: 8,
  lg: 12,
} as const;

export const typography = {
  title: { fontSize: 20, fontWeight: '500' as const },
  section: { fontSize: 16, fontWeight: '500' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 12, fontWeight: '400' as const },
  // Logging numbers must read at arm's length.
  logNumber: { fontSize: 18, fontWeight: '500' as const },
} as const;

// Minimum touch target (accessibility).
export const TOUCH_TARGET = 44;
