import { createId } from '@/lib/storage/app-data';
import type { SyncMetadata } from '@/lib/types/sync';
import { SYNC_METADATA_VERSION } from '@/lib/types/sync';

export const SYNC_METADATA_STORAGE_KEY = 'typelex.sync-metadata.v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function createDefaultSyncMetadata(): SyncMetadata {
  return {
    version: SYNC_METADATA_VERSION,
    deviceId: createId(),
    dirty: false,
    lastSyncedAt: null,
    lastRemoteUpdatedAt: null,
    lastSyncedUserId: null,
    pendingInitialUpload: false,
  };
}

export function parseSyncMetadata(input: unknown): SyncMetadata {
  const defaults = createDefaultSyncMetadata();

  if (!isRecord(input)) {
    return defaults;
  }

  return {
    version: SYNC_METADATA_VERSION,
    deviceId: typeof input.deviceId === 'string' && input.deviceId ? input.deviceId : defaults.deviceId,
    dirty: input.dirty === true,
    lastSyncedAt: typeof input.lastSyncedAt === 'string' ? input.lastSyncedAt : null,
    lastRemoteUpdatedAt: typeof input.lastRemoteUpdatedAt === 'string' ? input.lastRemoteUpdatedAt : null,
    lastSyncedUserId: typeof input.lastSyncedUserId === 'string' ? input.lastSyncedUserId : null,
    pendingInitialUpload: input.pendingInitialUpload === true,
  };
}

export function loadSyncMetadata(): SyncMetadata {
  if (typeof window === 'undefined') {
    return createDefaultSyncMetadata();
  }

  const raw = window.localStorage.getItem(SYNC_METADATA_STORAGE_KEY);

  if (!raw) {
    return createDefaultSyncMetadata();
  }

  try {
    return parseSyncMetadata(JSON.parse(raw));
  } catch {
    return createDefaultSyncMetadata();
  }
}

export function saveSyncMetadata(metadata: SyncMetadata): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SYNC_METADATA_STORAGE_KEY, JSON.stringify(metadata));
}
