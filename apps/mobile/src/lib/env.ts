// EXPO_PUBLIC_* values are inlined at build time, so each is read by its literal name.
export const env = {
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fkbrusgizujckpzxjpkv.supabase.co',
  supabaseKey:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_0PxQ8Hnb4MoCyOlqiM8jNA_wTIFKVc5',
  webUrl: process.env.EXPO_PUBLIC_WEB_URL || 'https://gravn.vercel.app',
};
