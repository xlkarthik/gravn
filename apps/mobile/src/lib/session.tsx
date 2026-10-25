import {
  type Access,
  needsOnboarding,
  pickWorkspace,
  type Shell,
  shellFor,
  type WorkspaceAccess,
} from '@gravn/shared';
import NetInfo from '@react-native-community/netinfo';
import type { Session } from '@supabase/supabase-js';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import Storage from 'expo-sqlite/kv-store';
import { createContext, type ReactNode, useContext, useEffect, useReducer, useState } from 'react';
import { AppState } from 'react-native';

import { flushOutbox, purgeLostWorkspaces } from './offline';
import { queryClient } from './query';
import { api, supabase } from './supabase';

type Status = 'loading' | 'signed_out' | 'signed_in' | 'error';

interface SessionValue {
  status: Status;
  session: Session | null;
  access?: Access;
  accessQuery: UseQueryResult<Access>;
  workspace?: WorkspaceAccess;
  shell?: Shell;
  onboarding: boolean;
  selectWorkspace: (id: string) => void;
  selectShell: (shell: Shell) => void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

// Who is signed in, which workspaces they can use (from get_my_access), and which one is open.
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!next) queryClient.clear();
      setSession(next);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const accessQuery = useQuery({
    queryKey: ['access', userId],
    enabled: !!userId,
    queryFn: async () => {
      const access = await api.getMyAccess();
      Storage.setItemSync(`access:${userId}`, JSON.stringify(access));
      return access;
    },
    // The last known access lets the app open offline; it is rechecked on every reconnect.
    initialData: () => {
      const cached = userId ? Storage.getItemSync(`access:${userId}`) : null;
      return cached ? (JSON.parse(cached) as Access) : undefined;
    },
  });

  const access = accessQuery.data;
  const workspaceKey = `workspace:${userId}`;
  const workspace = access && pickWorkspace(access, Storage.getItemSync(workspaceKey));
  const shellKey = workspace ? `shell:${userId}:${workspace.id}` : null;
  const preferredShell = (shellKey ? Storage.getItemSync(shellKey) : null) as Shell | null;

  // Forget cached data for workspaces this person no longer belongs to.
  // Workspace data is always keyed ['ws', workspaceId, …].
  useEffect(() => {
    if (!access) return;
    const ids = new Set(access.workspaces.map((w) => w.id));
    queryClient.removeQueries({
      predicate: (q) => q.queryKey[0] === 'ws' && !ids.has(q.queryKey[1] as string),
    });
    void purgeLostWorkspaces(access.user_id, [...ids]);
    void flushOutbox(access.user_id);
  }, [access]);

  useEffect(() => {
    if (!userId) return;
    const netSub = NetInfo.addEventListener((s) => {
      if (s.isConnected) void flushOutbox(userId);
    });
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushOutbox(userId);
    });
    return () => {
      netSub();
      appSub.remove();
    };
  }, [userId]);

  const status: Status =
    session === undefined
      ? 'loading'
      : session === null
        ? 'signed_out'
        : access
          ? 'signed_in'
          : accessQuery.isError
            ? 'error'
            : 'loading';

  const value: SessionValue = {
    status,
    session: session ?? null,
    access,
    accessQuery,
    workspace,
    shell: workspace && shellFor(workspace, preferredShell),
    onboarding: !!access && needsOnboarding(access),
    selectWorkspace: (id) => {
      Storage.setItemSync(workspaceKey, id);
      rerender();
    },
    selectShell: (nextShell) => {
      if (shellKey) Storage.setItemSync(shellKey, nextShell);
      rerender();
    },
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
