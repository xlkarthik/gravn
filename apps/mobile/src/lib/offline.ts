import {
  type ProgramAssignment,
  type SyncOpInput,
  syncBackoffMs,
  type WorkoutSessionRecord,
} from '@gravn/shared';
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  randomUUID,
} from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { queryClient } from './query';
import { api } from './supabase';

// Per-user SQLite store with AES-GCM payload encryption (D-60) and idempotent outbox sync (D-59).
// Key is stored in SecureStore with WHEN_UNLOCKED_THIS_DEVICE_ONLY so cloud/device backups never copy it.

const keys = new Map<string, Promise<AESEncryptionKey>>();
const dbs = new Map<string, Promise<SQLite.SQLiteDatabase>>();
const listeners = new Set<() => void>();

export function subscribeSyncState(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifySyncListeners() {
  for (const fn of listeners) fn();
}

function userKey(userId: string): Promise<AESEncryptionKey> {
  const storeName = `offline-key-${userId.slice(0, 16)}`;
  let p = keys.get(userId);
  if (!p) {
    p = (async () => {
      const hex = await SecureStore.getItemAsync(storeName, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      if (hex) return AESEncryptionKey.import(hex, 'hex');
      const created = await AESEncryptionKey.generate();
      await SecureStore.setItemAsync(storeName, await created.encoded('hex'), {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      return created;
    })();
    keys.set(userId, p);
  }
  return p;
}

const toAsciiJson = (value: unknown) =>
  JSON.stringify(value).replace(
    /[\u0080-\uffff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );

async function encryptJson(userId: string, value: unknown): Promise<string> {
  const key = await userKey(userId);
  const sealed = await aesEncryptAsync(btoa(toAsciiJson(value)), key);
  return sealed.combined('base64');
}

async function decryptJson<T>(userId: string, sealedBase64: string): Promise<T | null> {
  try {
    const key = await userKey(userId);
    const plainBase64 = await aesDecryptAsync(AESSealedData.fromCombined(sealedBase64), key, {
      output: 'base64',
    });
    return JSON.parse(atob(plainBase64)) as T;
  } catch {
    return null;
  }
}

async function userDb(userId: string): Promise<SQLite.SQLiteDatabase> {
  const safeId = userId.replace(/[^a-z0-9]/gi, '');
  let p = dbs.get(safeId);
  if (!p) {
    p = (async () => {
      const db = await SQLite.openDatabaseAsync(`gravn_${safeId}.db`);
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS plan_cache (
          workspace_id TEXT PRIMARY KEY NOT NULL,
          encrypted_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY NOT NULL,
          workspace_id TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          encrypted_json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS outbox (
          op_id TEXT PRIMARY KEY NOT NULL,
          workspace_id TEXT NOT NULL,
          type TEXT NOT NULL,
          encrypted_payload TEXT NOT NULL,
          base_revision INTEGER,
          created_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          last_error TEXT
        );
        CREATE TABLE IF NOT EXISTS timers (
          session_id TEXT PRIMARY KEY NOT NULL,
          ends_at INTEGER NOT NULL
        );
      `);
      return db;
    })();
    dbs.set(safeId, p);
  }
  return p;
}

// Plan cache ---------------------------------------------------------------

export async function cacheActivePlan(
  userId: string,
  workspaceId: string,
  assignment: ProgramAssignment | null,
): Promise<void> {
  const db = await userDb(userId);
  const encrypted = await encryptJson(userId, assignment);
  await db.runAsync(
    `INSERT OR REPLACE INTO plan_cache (workspace_id, encrypted_json, updated_at) VALUES (?, ?, ?)`,
    [workspaceId, encrypted, Date.now()],
  );
}

export async function getCachedActivePlan(
  userId: string,
  workspaceId: string,
): Promise<ProgramAssignment | null> {
  const db = await userDb(userId);
  const row = await db.getFirstAsync<{ encrypted_json: string }>(
    `SELECT encrypted_json FROM plan_cache WHERE workspace_id = ?`,
    [workspaceId],
  );
  if (!row) return null;
  return decryptJson<ProgramAssignment | null>(userId, row.encrypted_json);
}

// Local sessions & write-through outbox ------------------------------------

export async function saveLocalSession(
  userId: string,
  session: WorkoutSessionRecord,
  ops: Omit<SyncOpInput, 'op_id'>[],
): Promise<void> {
  const db = await userDb(userId);
  const encryptedSession = await encryptJson(userId, session);
  await db.runAsync(
    `INSERT OR REPLACE INTO sessions (id, workspace_id, status, started_at, encrypted_json) VALUES (?, ?, ?, ?, ?)`,
    [session.id, session.workspace_id, session.status, session.started_at, encryptedSession],
  );

  for (const op of ops) {
    const encryptedPayload = await encryptJson(userId, op.payload);
    await db.runAsync(
      `INSERT INTO outbox (op_id, workspace_id, type, encrypted_payload, base_revision, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [
        randomUUID(),
        session.workspace_id,
        op.type,
        encryptedPayload,
        op.base_revision ?? null,
        Date.now(),
      ],
    );
  }
  notifySyncListeners();
  void flushOutbox(userId);
}

export async function getLocalSessions(
  userId: string,
  workspaceId: string,
): Promise<WorkoutSessionRecord[]> {
  const db = await userDb(userId);
  const rows = await db.getAllAsync<{ encrypted_json: string }>(
    `SELECT encrypted_json FROM sessions WHERE workspace_id = ? ORDER BY started_at DESC LIMIT 30`,
    [workspaceId],
  );
  const list: WorkoutSessionRecord[] = [];
  for (const row of rows) {
    const decoded = await decryptJson<WorkoutSessionRecord>(userId, row.encrypted_json);
    if (decoded) list.push(decoded);
  }
  return list;
}

export async function getActiveLocalSession(
  userId: string,
  workspaceId: string,
): Promise<WorkoutSessionRecord | null> {
  const db = await userDb(userId);
  const row = await db.getFirstAsync<{ encrypted_json: string }>(
    `SELECT encrypted_json FROM sessions WHERE workspace_id = ? AND status = 'in_progress' ORDER BY started_at DESC LIMIT 1`,
    [workspaceId],
  );
  if (!row) return null;
  return decryptJson<WorkoutSessionRecord>(userId, row.encrypted_json);
}

// Rest timer persistence ---------------------------------------------------

export async function setPersistedTimer(
  userId: string,
  sessionId: string,
  endsAtMs: number | null,
): Promise<void> {
  const db = await userDb(userId);
  if (endsAtMs === null) {
    await db.runAsync(`DELETE FROM timers WHERE session_id = ?`, [sessionId]);
  } else {
    await db.runAsync(`INSERT OR REPLACE INTO timers (session_id, ends_at) VALUES (?, ?)`, [
      sessionId,
      endsAtMs,
    ]);
  }
}

export async function getPersistedTimer(userId: string, sessionId: string): Promise<number | null> {
  const db = await userDb(userId);
  const row = await db.getFirstAsync<{ ends_at: number }>(
    `SELECT ends_at FROM timers WHERE session_id = ?`,
    [sessionId],
  );
  return row?.ends_at ?? null;
}

// Outbox sync engine -------------------------------------------------------

export interface OutboxStatus {
  pendingCount: number;
  errorCount: number;
  syncing: boolean;
}

let isFlushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export async function getOutboxStatus(userId: string): Promise<OutboxStatus> {
  const db = await userDb(userId);
  const rows = await db.getAllAsync<{ status: string; cnt: number }>(
    `SELECT status, COUNT(*) as cnt FROM outbox GROUP BY status`,
  );
  let pendingCount = 0;
  let errorCount = 0;
  for (const r of rows) {
    if (r.status === 'pending') pendingCount += r.cnt;
    if (r.status === 'error') errorCount += r.cnt;
  }
  return { pendingCount: pendingCount + errorCount, errorCount, syncing: isFlushing };
}

export async function flushOutbox(userId: string): Promise<boolean> {
  if (isFlushing) return false;
  isFlushing = true;
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
  notifySyncListeners();

  try {
    const db = await userDb(userId);
    const rows = await db.getAllAsync<{
      op_id: string;
      type: SyncOpInput['type'];
      encrypted_payload: string;
      base_revision: number | null;
      attempts: number;
    }>(
      `SELECT op_id, type, encrypted_payload, base_revision, attempts FROM outbox ORDER BY created_at ASC LIMIT 50`,
    );

    if (rows.length === 0) {
      isFlushing = false;
      notifySyncListeners();
      return true;
    }

    const ops: SyncOpInput[] = [];
    for (const r of rows) {
      const payload = await decryptJson<Record<string, unknown>>(userId, r.encrypted_payload);
      if (payload) {
        ops.push({
          op_id: r.op_id,
          type: r.type,
          payload,
          ...(r.base_revision !== null ? { base_revision: r.base_revision } : {}),
        });
      }
    }

    await api.syncPush(ops);

    for (const r of rows) {
      await db.runAsync(`DELETE FROM outbox WHERE op_id = ?`, [r.op_id]);
    }
    void queryClient.invalidateQueries({ queryKey: ['ws'] });
    isFlushing = false;
    notifySyncListeners();
    return true;
  } catch (err) {
    const db = await userDb(userId);
    const message = (err as { message?: string } | null)?.message ?? 'sync_failed';
    await db.runAsync(
      `UPDATE outbox SET attempts = attempts + 1, status = 'error', last_error = ?`,
      [message],
    );
    const maxRow = await db.getFirstAsync<{ m: number }>(`SELECT MAX(attempts) as m FROM outbox`);
    const delay = syncBackoffMs(maxRow?.m ?? 1, Math.random() * 0.4 - 0.2);
    retryTimer = setTimeout(() => void flushOutbox(userId), delay);
    isFlushing = false;
    notifySyncListeners();
    return false;
  }
}

export async function discardOutbox(userId: string): Promise<void> {
  const db = await userDb(userId);
  await db.runAsync(`DELETE FROM outbox`);
  notifySyncListeners();
}

export async function purgeLostWorkspaces(
  userId: string,
  allowedWorkspaceIds: readonly string[],
): Promise<void> {
  const db = await userDb(userId);
  if (allowedWorkspaceIds.length === 0) {
    await db.execAsync(`DELETE FROM plan_cache; DELETE FROM sessions; DELETE FROM outbox;`);
    notifySyncListeners();
    return;
  }
  const placeholders = allowedWorkspaceIds.map(() => '?').join(',');
  await db.runAsync(`DELETE FROM plan_cache WHERE workspace_id NOT IN (${placeholders})`, [
    ...allowedWorkspaceIds,
  ]);
  await db.runAsync(`DELETE FROM sessions WHERE workspace_id NOT IN (${placeholders})`, [
    ...allowedWorkspaceIds,
  ]);
  await db.runAsync(`DELETE FROM outbox WHERE workspace_id NOT IN (${placeholders})`, [
    ...allowedWorkspaceIds,
  ]);
  notifySyncListeners();
}
