import { t, workspaceSchema } from '@gravn/shared';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Message, Screen, TextField } from '@/components/ui';
import { queryClient } from '@/lib/query';
import { useSession } from '@/lib/session';
import { api } from '@/lib/supabase';
import { errorText, useForm } from '@/lib/use-form';

// Create a gym, or a coaching workspace for an independent trainer.
export default function CreateWorkspace() {
  const type = useLocalSearchParams<{ type: string }>().type === 'coach' ? 'coach' : 'gym';
  const { selectWorkspace } = useSession();
  const form = useForm(workspaceSchema, { type, name: '' });
  const create = useMutation({
    mutationFn: (name: string) => api.createWorkspace(type, name),
    onSuccess: async (id) => {
      selectWorkspace(id);
      await queryClient.refetchQueries({ queryKey: ['access'] });
      router.replace('/');
    },
  });

  return (
    <Screen title={t(type === 'gym' ? 'onboarding.create_gym' : 'onboarding.coach')}>
      <TextField
        label={t(type === 'gym' ? 'onboarding.gym_name' : 'onboarding.coach_name')}
        autoComplete="organization"
        {...form.field('name')}
      />
      <Button
        label={t('onboarding.create')}
        loading={create.isPending}
        onPress={() => {
          const data = form.validate();
          if (data) create.mutate(data.name);
        }}
      />
      <Message tone="error" text={errorText(create.error)} />
    </Screen>
  );
}
