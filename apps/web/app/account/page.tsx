import { roleKey, t } from '@gravn/shared';
import Link from 'next/link';

import { Form } from '@/components/form';
import { Card } from '@/components/ui';
import { fields } from '@/lib/fields';
import { api, getUser, requireAccess } from '@/lib/supabase';

import { signOut } from '../(auth)/actions';
import { updateProfile } from '../actions';

export default async function AccountPage() {
  const access = await requireAccess();
  const user = (await getUser())!;
  const profile = await (await api()).profile(user.id);

  return (
    <Card title={t('account.title')}>
      <p className="muted">{user.email}</p>
      <Form
        action={updateProfile}
        submit={t('common.save')}
        fields={[
          { ...fields.displayName, defaultValue: profile.display_name },
          {
            name: 'unitSystem',
            label: t('account.units'),
            type: 'select',
            defaultValue: profile.unit_system,
            options: [
              { value: 'metric', label: t('account.metric') },
              { value: 'imperial', label: t('account.imperial') },
            ],
          },
        ]}
      />
      <div>
        <h2>{t('account.workspaces')}</h2>
        <ul className="rows">
          {access.workspaces.map((w) => (
            <li key={w.id}>
              <span className="grow">{w.type === 'personal' ? t('roles.personal') : w.name}</span>
              <span className="badge">{t(roleKey(w))}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2>{t('account.privacy')}</h2>
        <p className="muted">
          {t('account.privacy_body')} {t('common.coming', { part: 5 })}
        </p>
      </div>
      <Link href="/home">{t('common.back')}</Link>
      <Form action={signOut} submit={t('common.sign_out')} variant="secondary" />
    </Card>
  );
}
