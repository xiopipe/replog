/**
 * MuscleFigure — renders front + back body-highlighter figures.
 *
 * Muscle-slug mapping (app enum → library slugs):
 *   chest              → chest
 *   back               → upper-back, lower-back, trapezius
 *   shoulders          → deltoids
 *   arms               → biceps, triceps, forearm
 *   quads              → quadriceps
 *   hamstrings_glutes  → hamstring, gluteal
 *   calves             → calves
 *   core               → abs, obliques
 *
 * Primary muscles use intensity 2 (maps to colors[1] = musclePrimary).
 * Secondary muscles use intensity 1 (maps to colors[0] = muscleSecondary).
 * The `colors` prop is ordered [secondary, primary] so intensity values map
 * correctly per the library's convention (intensity 1 → colors[0]).
 */

import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';
import type { MuscleEnum, MuscleRoleEnum } from '@/db';

// ---------------------------------------------------------------------------
// Slug mapping
// ---------------------------------------------------------------------------

const FRONT_SLUGS: Slug[] = [
  'chest',
  'deltoids',
  'biceps',
  'forearm',
  'quadriceps',
  'abs',
  'obliques',
];

const BACK_SLUGS: Slug[] = [
  'upper-back',
  'lower-back',
  'trapezius',
  'triceps',
  'hamstring',
  'gluteal',
  'calves',
];

/** Maps a MuscleEnum to all body-highlighter slugs it covers. */
const MUSCLE_TO_SLUGS: Record<MuscleEnum, Slug[]> = {
  chest: ['chest'],
  back: ['upper-back', 'lower-back', 'trapezius'],
  shoulders: ['deltoids'],
  arms: ['biceps', 'triceps', 'forearm'],
  quads: ['quadriceps'],
  hamstrings_glutes: ['hamstring', 'gluteal'],
  calves: ['calves'],
  core: ['abs', 'obliques'],
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MuscleFigureProps {
  muscles: { muscle: MuscleEnum; role: MuscleRoleEnum }[];
  scale?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders a front and back body figure side-by-side with highlighted muscles.
 * Primary muscles = musclePrimary (intensity 2), secondary = muscleSecondary (intensity 1).
 */
export function MuscleFigure({ muscles, scale = 1.4 }: MuscleFigureProps) {
  const { t } = useTranslation();

  // Build ExtendedBodyPart entries from the muscle list
  const bodyParts: ExtendedBodyPart[] = [];

  for (const { muscle, role } of muscles) {
    const slugs = MUSCLE_TO_SLUGS[muscle];
    const intensity = role === 'primary' ? 2 : 1;
    for (const slug of slugs) {
      // Avoid duplicates (in case same slug appears twice)
      if (!bodyParts.find((p) => p.slug === slug)) {
        bodyParts.push({ slug, intensity });
      } else {
        // If already present at lower intensity, upgrade it
        const existing = bodyParts.find((p) => p.slug === slug);
        if (existing && existing.intensity !== undefined && existing.intensity < intensity) {
          existing.intensity = intensity;
        }
      }
    }
  }

  // Split into front/back subsets
  const frontParts = bodyParts.filter((p) => p.slug && FRONT_SLUGS.includes(p.slug as Slug));
  const backParts = bodyParts.filter((p) => p.slug && BACK_SLUGS.includes(p.slug as Slug));

  // Colors array: [index 0 = intensity 1 = secondary, index 1 = intensity 2 = primary]
  const figureColors: [string, string] = [colors.muscleSecondary, colors.musclePrimary];

  return (
    <View style={styles.row}>
      <View
        accessibilityLabel={t('exercise.figure_front')}
        accessibilityRole="image"
      >
        <Body
          data={frontParts}
          side="front"
          gender="male"
          scale={scale}
          colors={figureColors}
          defaultFill={colors.surfaceAlt}
          border={colors.border}
        />
      </View>
      <View
        accessibilityLabel={t('exercise.figure_back')}
        accessibilityRole="image"
      >
        <Body
          data={backParts}
          side="back"
          gender="male"
          scale={scale}
          colors={figureColors}
          defaultFill={colors.surfaceAlt}
          border={colors.border}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
});
