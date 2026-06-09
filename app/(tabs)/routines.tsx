import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { spacing } from '@/lib/theme';

export default function RoutinesScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen title={t('routines.title')}>
      <View style={styles.content}>
        <EmptyState message={t('routines.empty')} />
        <View style={styles.actions}>
          <Button
            label={t('catalog.title')}
            variant="secondary"
            onPress={() => router.push('/catalog')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  actions: {
    padding: spacing.lg,
  },
});
