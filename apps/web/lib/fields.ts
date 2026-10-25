import { t } from '@gravn/shared';

import type { FieldSpec } from '@/components/form';

// Field definitions reused across forms.
export const fields = {
  email: { name: 'email', label: t('auth.email'), type: 'email', autoComplete: 'email' },
  password: {
    name: 'password',
    label: t('auth.password'),
    type: 'password',
    autoComplete: 'current-password',
  },
  newPassword: {
    name: 'password',
    label: t('auth.new_password'),
    type: 'password',
    autoComplete: 'new-password',
  },
  displayName: { name: 'displayName', label: t('auth.display_name'), autoComplete: 'name' },
} satisfies Record<string, FieldSpec>;

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const param = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';
