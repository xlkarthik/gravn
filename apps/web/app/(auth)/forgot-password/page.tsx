import { t } from '@gravn/shared';
import Link from 'next/link';

import { Form } from '@/components/form';
import { Card } from '@/components/ui';
import { fields } from '@/lib/fields';

import { forgotPassword } from '../actions';

export default function ForgotPasswordPage() {
  return (
    <Card title={t('auth.forgot_title')}>
      <p className="muted">{t('auth.forgot_body')}</p>
      <Form action={forgotPassword} submit={t('auth.send_link')} fields={[fields.email]} />
      <div className="links">
        <Link href="/sign-in">{t('auth.to_sign_in')}</Link>
      </div>
    </Card>
  );
}
