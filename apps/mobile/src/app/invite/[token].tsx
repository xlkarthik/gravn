import { formatDate, invitationView, t } from '@gravn/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { Body, Button, Message, QueryView, Screen, Title, Wordmark } from '@/components/ui';
import { queryClient } from '@/lib/query';
import { useSession } from '@/lib/session';
import { api, supabase } from '@/lib/supabase';
import { errorText } from '@/lib/use-form';

// Opened from an invitation link (gravn://invite/<token>) or a pasted one. Every case
// gets its own message: invalid, expired, used, revoked, signed out, wrong account,
// already a member, or ready to accept.
export default function Invite() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { status, selectWorkspace } = useSession();
  const info = useQuery({
    queryKey: ['invitation', token, status],
    queryFn: () => api.getInvitation(token),
  });
  const accept = useMutation({
    mutationFn: () => api.acceptInvitation(token),
    onSuccess: async (workspaceId) => {
      selectWorkspace(workspaceId);
      await queryClient.refetchQueries({ queryKey: ['access'] });
      router.replace('/');
    },
  });
  const here = encodeURIComponent(`/invite/${token}`);

  return (
    <Screen>
      <Wordmark />
      <QueryView query={info}>
        {(inv) => {
          const view = invitationView(inv);
          const vars = { workspace: inv.workspace_name ?? '', email: inv.email_hint ?? '' };
          return (
            <>
              <Title>{t(`invitation.${view}_title`, vars)}</Title>
              {view === 'ready' ? (
                <>
                  <Body>{t('invitation.role_line', { role: t(`roles.${inv.role}`) })}</Body>
                  <Body muted>
                    {t('invitation.expires', { date: formatDate(inv.expires_at!) })}
                  </Body>
                  <Button
                    label={t('invitation.accept')}
                    loading={accept.isPending}
                    onPress={() => accept.mutate()}
                  />
                  <Message tone="error" text={errorText(accept.error)} />
                </>
              ) : (
                <Body muted>
                  {view === 'sign_in' && !inv.email_hint
                    ? t('invitation.sign_in_open_body')
                    : t(`invitation.${view}_body`, vars)}
                </Body>
              )}
              {view === 'sign_in' && (
                <>
                  <Button
                    label={t('auth.sign_in')}
                    onPress={() => router.push(`/sign-in?next=${here}`)}
                  />
                  <Button
                    label={t('auth.sign_up')}
                    variant="secondary"
                    onPress={() => router.push(`/sign-up?next=${here}`)}
                  />
                </>
              )}
              {view === 'wrong_account' && (
                <Button
                  label={t('common.sign_out')}
                  variant="secondary"
                  onPress={() => void supabase.auth.signOut()}
                />
              )}
              {view !== 'ready' && view !== 'sign_in' && view !== 'wrong_account' && (
                <Button
                  label={t('common.continue')}
                  variant="secondary"
                  onPress={() => router.replace('/')}
                />
              )}
            </>
          );
        }}
      </QueryView>
    </Screen>
  );
}
