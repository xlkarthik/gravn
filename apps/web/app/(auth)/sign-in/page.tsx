import { t, tError } from '@gravn/shared';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { Form } from '@/components/form';
import { Card } from '@/components/ui';
import { fields, param, type SearchParams } from '@/lib/fields';
import { getUser, safeNext } from '@/lib/supabase';

import { signIn } from '../actions';

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, error } = await searchParams;
  if (await getUser()) redirect(safeNext(param(next)));
  const keep = next ? `?next=${encodeURIComponent(param(next))}` : '';

  return (
    <Card title={t('auth.sign_in_title')}>
      {error && (
        <p role="alert" className="message error">
          {tError(param(error))}
        </p>
      )}
      <Form
        action={signIn}
        submit={t('auth.sign_in')}
        hidden={{ next: param(next) }}
        fields={[fields.email, fields.password]}
      />
      <div className="links">
        <Link href={`/sign-up${keep}`}>{t('auth.to_sign_up')}</Link>
        <Link href="/forgot-password">{t('auth.forgot')}</Link>
      </div>
    </Card>
  );
}
