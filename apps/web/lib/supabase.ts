import { type Access, gravnApi, isOwner, isStaff } from '@gravn/shared';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import { env } from './env';

// One client per request; RLS decides what it can read.
export const supabase = cache(async () => {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components can't set cookies; proxy.ts refreshes the session instead.
        }
      },
    },
  });
});

export const api = cache(async () => gravnApi(await supabase()));

export const getUser = cache(async () => {
  const { data } = await (await supabase()).auth.getClaims();
  return data?.claims ? { id: data.claims.sub, email: data.claims.email as string } : null;
});

// Once per request, shared by layouts and pages.
export const requireAccess = cache(async (): Promise<Access> => {
  if (!(await getUser())) redirect('/sign-in');
  return (await api()).getMyAccess();
});

// Owner-only dashboard pages (trainers, workspace settings).
export async function requireOwnedWorkspace(id: string) {
  const access = await requireAccess();
  const ws = access.workspaces.find((w) => w.id === id && w.type !== 'personal' && isOwner(w));
  if (!ws) notFound();
  return { access, ws };
}

// Shared dashboard pages (overview, members/clients, and Part 2 programs): owners and trainers (D-58).
export async function requireStaffWorkspace(id: string) {
  const access = await requireAccess();
  const ws = access.workspaces.find((w) => w.id === id && isStaff(w));
  if (!ws) notFound();
  return { access, ws };
}

// Only same-site paths and the app's own schemes, never another site.
export function safeNext(next: unknown, fallback = '/home'): string {
  if (typeof next !== 'string' || !next) return fallback;
  if (next.startsWith('/') && !next.startsWith('//')) return next;
  if (next.startsWith(env.siteUrl)) return next.slice(env.siteUrl.length) || '/';
  if (/^gravn(-dev|-preview)?:\/\//.test(next)) return next;
  return fallback;
}
