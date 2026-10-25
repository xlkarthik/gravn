import { formatDate, invitationView, t } from '@gravn/shared';

import { Form } from '@/components/form';
import { ButtonLink, Card } from '@/components/ui';
import { env } from '@/lib/env';
import { api } from '@/lib/supabase';

import { signOut } from '../../(auth)/actions';
import { acceptInvitation } from '../../actions';

// One screen per invitation case: invalid, expired, used, revoked, signed out,
// wrong account, already a member, or ready to accept.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await (await api()).getInvitation(token);
  const view = invitationView(info);
  const vars = { workspace: info.workspace_name ?? '', email: info.email_hint ?? '' };
  const here = `/invite/${token}`;
  const title = t(`invitation.${view}_title`, vars);

  return (
    <Card title={title}>
      {view === 'ready' ? (
        <>
          <p>{t('invitation.role_line', { role: t(`roles.${info.role}`) })}</p>
          <p className="muted">{t('invitation.expires', { date: formatDate(info.expires_at!) })}</p>
          <Form action={acceptInvitation} submit={t('invitation.accept')} hidden={{ token }} />
        </>
      ) : (
        <p className="muted">
          {view === 'sign_in' && !info.email_hint
            ? t('invitation.sign_in_open_body')
            : t(`invitation.${view}_body`, vars)}
        </p>
      )}

      {view === 'sign_in' && (
        <>
          <ButtonLink href={`/sign-in?next=${encodeURIComponent(here)}`}>
            {t('auth.sign_in')}
          </ButtonLink>
          <ButtonLink href={`/sign-up?next=${encodeURIComponent(here)}`} variant="secondary">
            {t('auth.sign_up')}
          </ButtonLink>
        </>
      )}
      {view === 'wrong_account' && (
        <Form action={signOut} submit={t('common.sign_out')} hidden={{ next: here }} />
      )}
      {view === 'already_member' && <ButtonLink href="/home">{t('common.continue')}</ButtonLink>}
      {info.status === 'valid' && (
        <ButtonLink href={`${env.appScheme}://invite/${token}`} variant="secondary">
          {t('auth.open_app')}
        </ButtonLink>
      )}
    </Card>
  );
}
