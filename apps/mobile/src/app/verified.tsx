import { t } from '@gravn/shared';
import { router } from 'expo-router';

import { Body, Button, Screen, Title, Wordmark } from '@/components/ui';

// Opened by the confirmation email's link (gravn://verified) after the web verified it.
export default function Verified() {
  return (
    <Screen>
      <Wordmark />
      <Title>{t('auth.verified_title')}</Title>
      <Body muted>{t('auth.verified_body')}</Body>
      <Button label={t('common.continue')} onPress={() => router.replace('/')} />
    </Screen>
  );
}
