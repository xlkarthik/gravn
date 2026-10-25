import { t } from '@gravn/shared';
import Link from 'next/link';

import { Form } from '@/components/form';
import { Card } from '@/components/ui';
import { fields, param, type SearchParams } from '@/lib/fields';

import { signUp } from '../actions';

export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams;
  const keep = next ? `?next=${encodeURIComponent(param(next))}` : '';

  return (
    <Card title={t('auth.sign_up_title')}>
      <Form
        action={signUp}
        submit={t('auth.sign_up')}
        hidden={{ next: param(next) }}
        fields={[fields.displayName, fields.email, fields.newPassword]}
      />
      <div className="links">
        <Link href={`/sign-in${keep}`}>{t('auth.to_sign_in')}</Link>
      </div>
    </Card>
  );
}
