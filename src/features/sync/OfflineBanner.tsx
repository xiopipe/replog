/**
 * OfflineBanner — global offline indicator (TKT-0048).
 *
 * Shown below the status bar when the device has no internet connectivity.
 * Dismissed automatically when connectivity is restored. Never auto-dismissed
 * by a timeout while still offline.
 *
 * Copy: "Sin conexión — los cambios se guardan localmente y se sincronizarán al reconectar"
 */

import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, spacing, typography } from '@/lib/theme';
import { useNetworkState } from './useNetworkState';

export function OfflineBanner() {
  const { t } = useTranslation();
  const { isOffline } = useNetworkState();

  if (!isOffline) return null;

  return (
    <View
      style={styles.banner}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={t('sync.offline_banner')}
    >
      <Text style={styles.text} numberOfLines={2}>
        {t('sync.offline_banner')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...typography.label,
    color: colors.onAccent,
    textAlign: 'center',
    fontSize: 12,
  },
});
