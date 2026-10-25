import { emailSchema, t } from '@gravn/shared';
import { useMutation } from '@tanstack/react-query';

import { Body, Button, Message, Screen, TextField, TextLink, Title } from '@/components/ui';
import { authCall } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { errorText, useForm } from '@/lib/use-form';

// The emailed link opens the web app, where the new password is chosen.
export default function ForgotPassword() {
  const form = useForm(emailSchema, { email: '' });
  const send = useMutation({
    mutationFn: (email: string) => authCall(supabase.auth.resetPasswordForEmail(email)),
  });

  return (
    <Screen>
      <Title>{t('auth.forgot_title')}</Title>
      <Body muted>{t('auth.forgot_body')}</Body>
      <TextField
        label={t('auth.email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        {...form.field('email')}
      />
      <Button
        label={t('auth.send_link')}
        loading={send.isPending}
        onPress={() => {
          const data = form.validate();
          if (data) send.mutate(data.email);
        }}
      />
      <Message tone="error" text={errorText(send.error)} />
      <Message
        tone="notice"
        text={send.isSuccess ? t('auth.reset_sent', { email: form.values.email.trim() }) : null}
      />
      <TextLink href="/sign-in" label={t('auth.to_sign_in')} />
    </Screen>
  );
}
