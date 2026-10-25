// NEXT_PUBLIC_* values must be read with literal names so Next.js can inline them.
// Safe defaults point to the hosted Supabase project so Vercel builds succeed even before custom env vars are configured.
export const env = {
  supabaseUrl:
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fkbrusgizujckpzxjpkv.supabase.co',
  supabaseKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'sb_publishable_0PxQ8Hnb4MoCyOlqiM8jNA_wTIFKVc5',
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'),
  appScheme: process.env.NEXT_PUBLIC_APP_SCHEME ?? 'gravn',
};
