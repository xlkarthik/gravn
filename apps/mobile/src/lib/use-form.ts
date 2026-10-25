import { type FieldErrors, type FormSchema, parseForm, tError, toAppError } from '@gravn/shared';
import { useState } from 'react';

// Form state validated with the shared zod schemas. `field(name)` spreads into <TextField>.
export function useForm<T>(schema: FormSchema<T>, initial: Record<string, string>) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  return {
    values,
    field: (name: string) => ({
      value: values[name] ?? '',
      onChangeText: (text: string) => setValues((v) => ({ ...v, [name]: text })),
      error: errors[name] && tError(errors[name]),
    }),
    // Returns the parsed data, or null after showing the errors.
    validate: (): T | null => {
      const result = parseForm(schema, values);
      setErrors(result.ok ? {} : result.errors);
      return result.ok ? result.data : null;
    },
    reset: () => setValues(initial),
  };
}

export const errorText = (error: unknown) => (error ? tError(toAppError(error).key) : null);
