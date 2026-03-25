import { isAppDataEmpty } from '@/lib/storage/app-data';
import type { ReconcileAction, ReconcileInput } from '@/lib/types/sync';

function hasRemoteChangedSinceLastSync(lastRemoteUpdatedAt: string | null, remoteUpdatedAt: string | null): boolean {
  if (!remoteUpdatedAt) {
    return false;
  }

  if (!lastRemoteUpdatedAt) {
    return true;
  }

  return remoteUpdatedAt !== lastRemoteUpdatedAt;
}

export function reconcileSnapshot(input: ReconcileInput): ReconcileAction {
  if (!input.online) {
    return { type: 'offline' };
  }

  const localEmpty = isAppDataEmpty(input.localData);
  const remote = input.remoteSnapshot;

  if (!remote) {
    if (localEmpty) {
      return { type: input.localDirty ? 'push' : 'idle' };
    }

    return { type: 'confirm-initial-upload' };
  }

  const remoteChanged = hasRemoteChangedSinceLastSync(input.lastRemoteUpdatedAt, remote.updatedAt);

  if (localEmpty && !input.localDirty) {
    return { type: 'pull' };
  }

  if (!input.localDirty && remoteChanged) {
    return { type: 'pull' };
  }

  if (input.localDirty && !remoteChanged) {
    return { type: 'push' };
  }

  if (input.localDirty && remoteChanged) {
    return { type: 'conflict' };
  }

  return { type: 'idle' };
}
