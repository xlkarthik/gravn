import { type FieldErrors, t, tError, toAppError } from '@gravn/shared';
import { revalidatePath } from 'next/cache';

// What every server action returns to <Form>. Messages are already translated.
export type FormState =
  | {
      fieldErrors?: FieldErrors;
      error?: string;
      notice?: string;
      link?: string;
      values?: Record<string, string>;
    }
  | undefined;

export function fieldErrors(errors: FieldErrors, formData: FormData): FormState {
  return {
    fieldErrors: Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, tError(v)])),
    values: echo(formData),
  };
}

export function failed(key: string, formData?: FormData): FormState {
  return { error: tError(key), values: formData && echo(formData) };
}

// Runs a mutation, refreshes the dashboard, and turns database errors into messages.
export async function mutate(
  formData: FormData,
  fn: () => Promise<FormState | void>,
): Promise<FormState> {
  try {
    const result = await fn();
    revalidatePath('/', 'layout');
    return result ?? { notice: t('common.saved') };
  } catch (error) {
    return failed(toAppError(error).key, formData);
  }
}

// Re-fill the form after a failed submit, never with passwords.
function echo(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].filter(
      ([k, v]) => typeof v === 'string' && !k.includes('password'),
    ) as [string, string][],
  );
}

export const field = (formData: FormData, name: string) => String(formData.get(name) ?? '');
