import { signInSchema, t } from '@gravn/shared';
import { useMutation } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';

import { Button, Message, Screen, TextField, TextLink, Title, Wordmark } from '@/components/ui';
import { authCall } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { errorText, useForm } from '@/lib/use-form';

export default function SignIn() {
  // `next` brings people back to an invitation after signing in.
  const { next } = useLocalSearchParams<{ next?: string }>();
  const form = useForm(signInSchema, { email: '', password: '' });
  const signIn = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      authCall(supabase.auth.signInWithPassword(data)),
    onSuccess: () => next && router.replace(next),
  });
  const keep = next ? `?next=${encodeURIComponent(next)}` : '';

  return (
    <Screen>
      <Wordmark />
      <Title>{t('auth.sign_in_title')}</Title>
      <TextField
        label={t('auth.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        {...form.field('email')}
      />
      <TextField
        label={t('auth.password')}
        secureTextEntry
        autoComplete="current-password"
        {...form.field('password')}
      />
      <Button
        label={t('auth.sign_in')}
        loading={signIn.isPending}
        onPress={() => {
          const data = form.validate();
          if (data) signIn.mutate(data);
        }}
      />
      <Message tone="error" text={errorText(signIn.error)} />
      <TextLink href={`/sign-up${keep}`} label={t('auth.to_sign_up')} />
      <TextLink href="/forgot-password" label={t('auth.forgot')} />
    </Screen>
  );
}
