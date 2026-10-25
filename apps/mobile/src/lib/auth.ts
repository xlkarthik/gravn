import { AppError, authErrorKey } from '@gravn/shared';

// Supabase Auth returns errors instead of throwing; turn them into translatable AppErrors.
export async function authCall(
  call: PromiseLike<{ error: { code?: string } | null }>,
): Promise<void> {
  const { error } = await call;
  if (error) throw new AppError(authErrorKey(error));
}
