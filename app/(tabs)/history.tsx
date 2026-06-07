import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';

export default function HistoryScreen() {
  const { t } = useTranslation();
  return (
    <Screen title={t('history.title')}>
      <EmptyState message={t('history.empty')} />
    </Screen>
  );
}
