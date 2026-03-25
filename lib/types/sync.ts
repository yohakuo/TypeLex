import type { Session } from '@supabase/supabase-js';
import type { AppData } from '@/lib/types/domain';

export const SYNC_METADATA_VERSION = 1;

export interface SyncMetadata {
  version: 1;
  deviceId: string;
  dirty: boolean;
  lastSyncedAt: string | null;
  lastRemoteUpdatedAt: string | null;
  lastSyncedUserId: string | null;
  pendingInitialUpload: boolean;
}

export interface RemoteAppSnapshot {
  snapshot: AppData;
  schemaVersion: number;
  updatedAt: string | null;
  updatedByDeviceId: string | null;
}

export type ReconcileActionType = 'idle' | 'pull' | 'push' | 'conflict' | 'confirm-initial-upload' | 'offline';

export interface ReconcileAction {
  type: ReconcileActionType;
}

export interface ReconcileInput {
  localData: AppData;
  localDirty: boolean;
  lastRemoteUpdatedAt: string | null;
  remoteSnapshot: RemoteAppSnapshot | null;
  online: boolean;
}

export interface SyncConflictState {
  localData: AppData;
  remoteSnapshot: RemoteAppSnapshot;
}

export type SyncStatus =
  | 'disabled'
  | 'signed-out'
  | 'checking'
  | 'synced'
  | 'pending'
  | 'offline'
  | 'conflict'
  | 'needs-initial-upload'
  | 'error';

export interface SyncState {
  available: boolean;
  status: SyncStatus;
  statusLabel: string;
  isOnline: boolean;
  isBusy: boolean;
  email: string | null;
  session: Session | null;
  errorMessage: string | null;
  metadata: SyncMetadata;
  conflict: SyncConflictState | null;
}
