import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/lib/auth';
import { spacing } from '@/lib/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  return (
    <Screen title={t('settings.title')}>
      <View style={styles.body}>
        <Button label={t('auth.logout')} variant="secondary" onPress={() => signOut()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg },
});
