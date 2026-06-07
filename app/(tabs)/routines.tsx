import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function RoutinesScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('routines.title')}>
      <EmptyState message={t('routines.empty')} />
    </Screen>
  );
}
