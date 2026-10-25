import { redirect } from 'next/navigation';

import { getUser } from '@/lib/supabase';

export default async function Root() {
  redirect((await getUser()) ? '/home' : '/sign-in');
}
