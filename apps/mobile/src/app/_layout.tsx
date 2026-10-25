import { colors } from '@gravn/shared';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { queryClient } from '@/lib/query';
import { SessionProvider, useSession } from '@/lib/session';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <StatusBar style="light" />
        <Routes />
      </SessionProvider>
    </QueryClientProvider>
  );
}

// Which route groups exist depends on who is signed in and which workspace is open.
// When a group disappears (sign-out, removed from a gym, workspace switch), the router
// falls back to index, which redirects to the right place. The database enforces access;
// this only decides what to show.
function Routes() {
  const { status, shell, onboarding } = useSession();
  const ready = status === 'signed_in' && !onboarding;

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync();
  }, [status]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'signed_out'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'signed_in' && onboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={ready && shell === 'member'}>
        <Stack.Screen name="(member)" />
      </Stack.Protected>
      <Stack.Protected guard={ready && shell === 'trainer'}>
        <Stack.Screen name="(trainer)" />
      </Stack.Protected>
      <Stack.Protected guard={ready && shell === 'owner'}>
        <Stack.Screen name="(owner)" />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen
          name="member/[id]"
          options={{
            headerShown: true,
            title: '',
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
          }}
        />
      </Stack.Protected>
      <Stack.Screen name="invite/[token]" />
      <Stack.Screen name="verified" />
    </Stack>
  );
}
