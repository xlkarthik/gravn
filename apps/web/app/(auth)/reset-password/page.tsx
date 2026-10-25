import { t } from '@gravn/shared';

import { Form } from '@/components/form';
import { ButtonLink, Card } from '@/components/ui';
import { fields } from '@/lib/fields';
import { getUser } from '@/lib/supabase';

import { resetPassword } from '../actions';

// Reached from the recovery email, which signs the person in for this one step.
export default async function ResetPasswordPage() {
  if (!(await getUser())) {
    return (
      <Card title={t('auth.new_password_title')}>
        <p role="alert" className="message error">
          {t('errors.link_invalid')}
        </p>
        <ButtonLink href="/forgot-password">{t('auth.send_link')}</ButtonLink>
      </Card>
    );
  }
  return (
    <Card title={t('auth.new_password_title')}>
      <Form
        action={resetPassword}
        submit={t('auth.update_password')}
        fields={[fields.newPassword]}
      />
    </Card>
  );
}
