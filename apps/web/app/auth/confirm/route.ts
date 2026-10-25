import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';

import { safeNext, supabase } from '@/lib/supabase';

// Every auth email links here (supabase/templates). The token is verified server-side,
// then the person continues to `next`: a web page or, from the phone, the app.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get('token_hash');
  const type = params.get('type') as EmailOtpType | null;

  if (tokenHash && type) {
    const { error } = await (await supabase()).auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(safeNext(params.get('next'), '/verified'));
  }
  redirect('/sign-in?error=link_invalid');
}
