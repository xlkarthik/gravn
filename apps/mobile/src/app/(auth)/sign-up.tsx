import { signUpSchema, t } from '@gravn/shared';
import { useMutation } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { getCalendars } from 'expo-localization';
import { useLocalSearchParams } from 'expo-router';

import { Button, Message, Screen, TextField, TextLink, Title, Wordmark } from '@/components/ui';
import { authCall } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { errorText, useForm } from '@/lib/use-form';

export default function SignUp() {
  const { next } = useLocalSearchParams<{ next?: string }>();
  const form = useForm(signUpSchema, { displayName: '', email: '', password: '' });
  const signUp = useMutation({
    mutationFn: ({
      displayName,
      email,
      password,
    }: {
      displayName: string;
      email: string;
      password: string;
    }) =>
      authCall(
        supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName, timezone: getCalendars()[0]?.timeZone },
            // After confirming in the browser, the email link reopens the app here.
            emailRedirectTo: Linking.createURL(next ? next.replace(/^\//, '') : 'verified'),
          },
        }),
      ),
  });
  const keep = next ? `?next=${encodeURIComponent(next)}` : '';

  return (
    <Screen>
      <Wordmark />
      <Title>{t('auth.sign_up_title')}</Title>
      {signUp.isSuccess ? (
        <Message tone="notice" text={t('auth.confirm_sent', { email: form.values.email.trim() })} />
      ) : (
        <>
          <TextField
            label={t('auth.display_name')}
            autoComplete="name"
            {...form.field('displayName')}
          />
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
            autoComplete="new-password"
            {...form.field('password')}
          />
          <Button
            label={t('auth.sign_up')}
            loading={signUp.isPending}
            onPress={() => {
              const data = form.validate();
              if (data) signUp.mutate(data);
            }}
          />
          <Message tone="error" text={errorText(signUp.error)} />
        </>
      )}
      <TextLink href={`/sign-in${keep}`} label={t('auth.to_sign_in')} />
    </Screen>
  );
}
