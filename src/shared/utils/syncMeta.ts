import type { SyncStatus } from '../types';
import { now } from '../time';
import { createStableId } from './id';

export type SyncFields = {
  clientId: string;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus: SyncStatus;
};

type SyncEntityShape = {
  id?: string | null;
  clientId?: string;
  version?: number;
  updatedAt?: string;
  deletedAt?: string | null;
  syncStatus?: SyncStatus;
};

function normalizeSyncStatus(value: unknown): SyncStatus {
  if (value === 'local' || value === 'pending' || value === 'synced' || value === 'failed') {
    return value;
  }
  return 'local';
}

function isIsoLike(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms);
}

export function createSyncFields(prefix: string, updatedAtISO?: string): SyncFields {
  const ts = isIsoLike(updatedAtISO) ? updatedAtISO : new Date(now()).toISOString();
  return {
    clientId: createStableId(prefix, Date.parse(ts)),
    version: 1,
    updatedAt: ts,
    deletedAt: null,
    syncStatus: 'local',
  };
}

export function withSyncDefaults<T extends SyncEntityShape>(
  entity: T,
  prefix: string,
  fallbackUpdatedAtISO?: string
): T {
  const updatedAtISO = isIsoLike(entity.updatedAt)
    ? entity.updatedAt
    : isIsoLike(fallbackUpdatedAtISO)
      ? fallbackUpdatedAtISO
      : new Date(now()).toISOString();

  const baseId = typeof entity.id === 'string' && entity.id.trim() ? entity.id : undefined;
  const clientId = typeof entity.clientId === 'string' && entity.clientId.trim()
    ? entity.clientId
    : baseId ?? createStableId(prefix, Date.parse(updatedAtISO));

  return {
    ...entity,
    clientId,
    version: Number.isInteger(entity.version) && (entity.version as number) > 0 ? (entity.version as number) : 1,
    updatedAt: updatedAtISO,
    deletedAt: isIsoLike(entity.deletedAt) ? entity.deletedAt : null,
    syncStatus: normalizeSyncStatus(entity.syncStatus),
  } as T;
}

export function touchSyncFields<T extends SyncEntityShape>(entity: T, nextStatus: SyncStatus = 'local'): T {
  const updatedAt = new Date(now()).toISOString();
  const normalized = withSyncDefaults(entity, 'ent', updatedAt);
  return {
    ...normalized,
    updatedAt: updatedAt,
    version: (normalized.version ?? 0) + 1,
    syncStatus: nextStatus,
    deletedAt: null,
  } as T;
}

export function markSyncDeleted<T extends SyncEntityShape>(entity: T, nextStatus: SyncStatus = 'local'): T {
  const deletedAt = new Date(now()).toISOString();
  const normalized = withSyncDefaults(entity, 'ent', deletedAt);
  return {
    ...normalized,
    updatedAt: deletedAt,
    deletedAt,
    version: (normalized.version ?? 0) + 1,
    syncStatus: nextStatus,
  } as T;
}
