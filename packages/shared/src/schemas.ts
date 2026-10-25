import { z } from 'zod';

// Messages are i18n keys, so both apps show the same translated text.
// Password rules match supabase/config.toml (8+ characters, letters and digits).

const email = z.string().trim().toLowerCase().pipe(z.email('validation.email'));
const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v || undefined)
  .pipe(z.email('validation.email').optional());
const password = z
  .string()
  .min(8, 'validation.password_short')
  .max(72, 'validation.password_long')
  .regex(/[A-Za-z]/, 'validation.password_letters_digits')
  .regex(/\d/, 'validation.password_letters_digits');
const name = z.string().trim().min(1, 'validation.required').max(80, 'validation.too_long');

export const signUpSchema = z.object({ displayName: name, email, password });
export const signInSchema = z.object({ email, password: z.string().min(1, 'validation.required') });
export const emailSchema = z.object({ email });
export const newPasswordSchema = z.object({ password });
export const workspaceSchema = z.object({ type: z.enum(['gym', 'coach']), name });
export const inviteSchema = z
  .object({
    email: optionalEmail,
    role: z.enum(['trainer', 'member']),
    clientRecordId: z
      .string()
      .trim()
      .optional()
      .transform((v) => v || undefined)
      .pipe(z.uuid().optional()),
  })
  .refine((d) => Boolean(d.email || d.clientRecordId), {
    path: ['email'],
    message: 'validation.email',
  });
export const clientRecordSchema = z.object({
  displayName: name,
  email: optionalEmail,
  phone: z
    .string()
    .trim()
    .max(20, 'validation.too_long')
    .transform((v) => v || undefined),
});
export const profileSchema = z.object({
  displayName: name,
  unitSystem: z.enum(['metric', 'imperial']),
});

export const exerciseSchema = z.object({
  name,
  instructions: z.string().trim().max(1000, 'validation.too_long').default(''),
  trackingType: z.enum(['weight_reps', 'reps', 'time']).default('weight_reps'),
  primaryMuscle: z.enum([
    'chest',
    'back',
    'shoulders',
    'quads',
    'hamstrings',
    'glutes',
    'biceps',
    'triceps',
    'calves',
    'core',
    'full_body',
  ]),
  equipmentId: z.enum([
    'barbell',
    'dumbbell',
    'machine',
    'cable',
    'bodyweight',
    'kettlebell',
    'band',
    'other',
  ]),
  defaultRestSeconds: z.coerce.number().int().min(0).max(600).default(90),
});

export const programSchema = z.object({
  name,
  description: z.string().trim().max(500, 'validation.too_long').default(''),
});

export const programDaySchema = z.object({
  title: name,
  weekIndex: z.coerce.number().int().min(1).max(52).default(1),
  dayIndex: z.coerce.number().int().min(1).max(14).default(1),
});

export const programItemSchema = z.object({
  exerciseId: z.uuid('validation.required'),
  setsCount: z.coerce.number().int().min(1).max(20).default(3),
  targetRepsMin: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  targetRepsMax: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  targetWeightValue: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  targetDurationS: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  restSeconds: z.coerce.number().int().min(0).max(600).default(90),
  supersetGroup: z
    .string()
    .trim()
    .max(16, 'validation.too_long')
    .optional()
    .transform((v) => v || undefined),
  notes: z.string().trim().max(500, 'validation.too_long').default(''),
});

export const commentSchema = z.object({
  body: z.string().trim().min(1, 'validation.required').max(1000, 'validation.too_long'),
});

export type FormSchema<T> = z.ZodType<T>;
export type FieldErrors = Record<string, string>;
export type Parsed<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

// Validate form input and return the first error key per field.
export function parseForm<S extends z.ZodType>(schema: S, input: unknown): Parsed<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'form');
    errors[field] ??= issue.message;
  }
  return { ok: false, errors };
}
