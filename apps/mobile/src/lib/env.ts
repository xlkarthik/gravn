function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy apps/mobile/.env.example to .env.local.`);
  return value;
}

// EXPO_PUBLIC_* values are inlined at build time, so each is read by its literal name.
export const env = {
  supabaseUrl: required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseKey: required(
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  webUrl: required('EXPO_PUBLIC_WEB_URL', process.env.EXPO_PUBLIC_WEB_URL),
};
