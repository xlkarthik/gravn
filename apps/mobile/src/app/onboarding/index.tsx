import { t } from '@gravn/shared';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';

import { ListItem, Message, Screen, Wordmark } from '@/components/ui';
import { useSession } from '@/lib/session';
import { api } from '@/lib/supabase';
import { errorText } from '@/lib/use-form';

// First run: the four ways into Gravn (plan 1.5).
export default function Onboarding() {
  const userId = useSession().session!.user.id;
  // Training alone uses the personal workspace every account already has.
  const solo = useMutation({ mutationFn: () => api.updateProfile(userId, { onboarded: true }) });

  return (
    <Screen title={t('onboarding.title')}>
      <Wordmark />
      <ListItem
        title={t('onboarding.create_gym')}
        subtitle={t('onboarding.create_gym_body')}
        onPress={() => router.push('/onboarding/create?type=gym')}
      />
      <ListItem
        title={t('onboarding.invitation')}
        subtitle={t('onboarding.invitation_body')}
        onPress={() => router.push('/onboarding/join')}
      />
      <ListItem
        title={t('onboarding.coach')}
        subtitle={t('onboarding.coach_body')}
        onPress={() => router.push('/onboarding/create?type=coach')}
      />
      <ListItem
        title={t('onboarding.solo')}
        subtitle={t('onboarding.solo_body')}
        onPress={() => solo.mutate()}
      />
      <Message tone="error" text={errorText(solo.error)} />
    </Screen>
  );
}
