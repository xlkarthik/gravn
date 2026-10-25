import { t } from '@gravn/shared';

import { ButtonLink, Card } from '@/components/ui';
import { env } from '@/lib/env';

export default function VerifiedPage() {
  return (
    <Card title={t('auth.verified_title')}>
      <p className="muted">{t('auth.verified_body')}</p>
      <ButtonLink href={`${env.appScheme}://sign-in`}>{t('auth.open_app')}</ButtonLink>
      <ButtonLink href="/home" variant="secondary">
        {t('common.continue')}
      </ButtonLink>
    </Card>
  );
}
