import { t } from '@gravn/shared';
import { Redirect } from 'expo-router';

import { Button, ErrorState, Loading, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

const HOME = { member: '/today', trainer: '/clients', owner: '/overview' } as const;

// Sends everyone to the right place for their current state.
export default function Index() {
  const { status, shell, onboarding, accessQuery } = useSession();

  if (status === 'signed_out') return <Redirect href="/sign-in" />;
  if (status === 'error') {
    return (
      <Screen>
        <ErrorState error={accessQuery.error} onRetry={() => void accessQuery.refetch()} />
        <Button
          label={t('common.sign_out')}
          variant="secondary"
          onPress={() => void supabase.auth.signOut()}
        />
      </Screen>
    );
  }
  if (status === 'loading' || !shell) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }
  return <Redirect href={onboarding ? '/onboarding' : HOME[shell]} />;
}
