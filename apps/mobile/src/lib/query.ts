import NetInfo from '@react-native-community/netinfo';
import { focusManager, MutationCache, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState } from 'react-native';

// Refetch when the app returns to the foreground or the network comes back. This is
// also how a removed trainer or member loses access on their next reconnect.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((s) => setOnline(!!s.isConnected)),
);
AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));

export const queryClient: QueryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  // Any successful change refreshes what's on screen.
  mutationCache: new MutationCache({ onSuccess: () => queryClient.invalidateQueries() }),
});
