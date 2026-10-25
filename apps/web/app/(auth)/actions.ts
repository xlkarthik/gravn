'use server';

import {
  authErrorKey,
  emailSchema,
  newPasswordSchema,
  parseForm,
  signInSchema,
  signUpSchema,
  t,
} from '@gravn/shared';
import { redirect } from 'next/navigation';

import { env } from '@/lib/env';
import { failed, field, fieldErrors, type FormState } from '@/lib/form-state';
import { safeNext, supabase } from '@/lib/supabase';

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(signInSchema, {
    email: field(formData, 'email'),
    password: field(formData, 'password'),
  });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  const { error } = await (await supabase()).auth.signInWithPassword(parsed.data);
  if (error) return failed(authErrorKey(error), formData);
  redirect(safeNext(formData.get('next')));
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(signUpSchema, {
    displayName: field(formData, 'displayName'),
    email: field(formData, 'email'),
    password: field(formData, 'password'),
  });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  const { displayName, email, password } = parsed.data;
  // The confirmation email links back to `next` (for example an invitation) after verifying.
  const next = safeNext(formData.get('next'), '/verified');
  const { error } = await (
    await supabase()
  ).auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName, timezone: field(formData, 'timezone') },
      emailRedirectTo: `${env.siteUrl}${next}`,
    },
  });
  if (error) return failed(authErrorKey(error), formData);
  return { notice: t('auth.confirm_sent', { email }) };
}

export async function forgotPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(emailSchema, { email: field(formData, 'email') });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  // The recovery email links to /auth/confirm, then /reset-password (supabase/templates/recovery.html).
  const { error } = await (await supabase()).auth.resetPasswordForEmail(parsed.data.email);
  // Same answer whether or not the account exists.
  if (error && authErrorKey(error) === 'rate_limited') return failed('rate_limited', formData);
  return { notice: t('auth.reset_sent', { email: parsed.data.email }) };
}

export async function resetPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(newPasswordSchema, { password: field(formData, 'password') });
  if (!parsed.ok) return fieldErrors(parsed.errors, formData);
  const { error } = await (await supabase()).auth.updateUser({ password: parsed.data.password });
  if (error) return failed(authErrorKey(error));
  redirect('/home');
}

export async function signOut(_: FormState, formData: FormData): Promise<FormState> {
  await (await supabase()).auth.signOut();
  redirect(safeNext(formData.get('next'), '/sign-in'));
}
