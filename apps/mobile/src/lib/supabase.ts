import { gravnApi } from '@gravn/shared';
import { createClient } from '@supabase/supabase-js';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';

import { env } from './env';

// The session is stored AES-GCM encrypted in SQLite. Its key lives in the device
// keystore through SecureStore, which only fits small values (plan 1.4).
let key: Promise<AESEncryptionKey> | undefined;
const sessionKey = () =>
  (key ??= (async () => {
    const hex = await SecureStore.getItemAsync('session-key');
    if (hex) return AESEncryptionKey.import(hex, 'hex');
    const created = await AESEncryptionKey.generate();
    await SecureStore.setItemAsync('session-key', await created.encoded('hex'));
    return created;
  })());

// Session values are JSON. Escaping non-ASCII keeps them valid JSON and safe for btoa.
const ascii = (json: string) =>
  json.replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

const encryptedStorage = {
  async getItem(name: string) {
    const sealed = await Storage.getItem(name);
    if (!sealed) return null;
    try {
      const plain = await aesDecryptAsync(AESSealedData.fromCombined(sealed), await sessionKey(), {
        output: 'base64',
      });
      return atob(plain);
    } catch {
      // Key lost (for example after a reinstall): drop the session and sign in again.
      await Storage.removeItem(name);
      return null;
    }
  },
  async setItem(name: string, value: string) {
    const sealed = await aesEncryptAsync(btoa(ascii(value)), await sessionKey());
    await Storage.setItem(name, await sealed.combined('base64'));
  },
  removeItem: (name: string) => Storage.removeItem(name),
};

export const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: {
    storage: encryptedStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener('change', (state) =>
  state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh(),
);

export const api = gravnApi(supabase);
