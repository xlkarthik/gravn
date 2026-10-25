import { t } from '@gravn/shared';
import type { ReactNode } from 'react';

import { EmptyState, Screen } from './ui';

// A tab whose feature arrives in a later part, labelled as such (never shown as working).
export function ComingSoon({
  tab,
  part,
  children,
}: {
  tab: string;
  part: number;
  children?: ReactNode;
}) {
  return (
    <Screen title={t(`tabs.${tab}`)}>
      {children}
      <EmptyState title={t('common.coming', { part })} body={t(`placeholder.${tab}`)} />
    </Screen>
  );
}
