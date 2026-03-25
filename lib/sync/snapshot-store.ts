import type { SupabaseClient } from '@supabase/supabase-js';
import { APP_DATA_VERSION, parseAppDataSnapshot } from '@/lib/storage/app-data';
import type { AppData } from '@/lib/types/domain';
import type { RemoteAppSnapshot } from '@/lib/types/sync';

const SNAPSHOT_TABLE = 'user_app_snapshots';

interface SnapshotRow {
  snapshot: unknown;
  schema_version: number | null;
  updated_at: string | null;
  updated_by_device_id: string | null;
}

function mapSnapshotRow(row: SnapshotRow | null): RemoteAppSnapshot | null {
  if (!row) {
    return null;
  }

  return {
    snapshot: parseAppDataSnapshot(row.snapshot),
    schemaVersion: row.schema_version ?? APP_DATA_VERSION,
    updatedAt: row.updated_at,
    updatedByDeviceId: row.updated_by_device_id,
  };
}

export async function fetchRemoteSnapshot(client: SupabaseClient, userId: string): Promise<RemoteAppSnapshot | null> {
  const { data, error } = await client
    .from(SNAPSHOT_TABLE)
    .select('snapshot, schema_version, updated_at, updated_by_device_id')
    .eq('user_id', userId)
    .maybeSingle<SnapshotRow>();

  if (error) {
    throw error;
  }

  return mapSnapshotRow(data);
}

export async function upsertRemoteSnapshot(
  client: SupabaseClient,
  userId: string,
  snapshot: AppData,
  deviceId: string,
): Promise<RemoteAppSnapshot> {
  const payload = {
    user_id: userId,
    snapshot,
    schema_version: APP_DATA_VERSION,
    updated_by_device_id: deviceId,
  };

  const { data, error } = await client
    .from(SNAPSHOT_TABLE)
    .upsert(payload)
    .select('snapshot, schema_version, updated_at, updated_by_device_id')
    .single<SnapshotRow>();

  if (error) {
    throw error;
  }

  return mapSnapshotRow(data)!;
}
