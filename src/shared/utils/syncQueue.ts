import type {
  SyncEntityType,
  SyncOperation,
  SyncOutboxEvent,
  SyncState,
  SyncTombstone,
} from '../types';

export type SyncEntitySnapshot = {
  id?: string | null;
  clientId?: string | null;
  version?: number;
  updatedAt?: string;
  deletedAt?: string | null;
};

const SYNC_SCHEMA_VERSION = 1 as const;

function isIsoLike(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return Number.isFinite(Date.parse(value));
}

function isSyncEntityType(value: unknown): value is SyncEntityType {
  return value === 'exercise' || value === 'set' || value === 'cardio' || value === 'log' || value === 'note';
}

function isSyncOperation(value: unknown): value is SyncOperation {
  return value === 'upsert' || value === 'delete';
}

function normalizeVersion(value: unknown): number {
  if (Number.isInteger(value) && (value as number) > 0) {
    return value as number;
  }
  return 1;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function entityKey(entityType: SyncEntityType, entityId: string): string {
  return `${entityType}::${entityId}`;
}

function dedupeOutbox(events: SyncOutboxEvent[]): SyncOutboxEvent[] {
  const byId = new Map<string, SyncOutboxEvent>();
  for (const event of events) {
    byId.set(event.id, event);
  }
  return Array.from(byId.values());
}

function dedupeTombstones(tombstones: SyncTombstone[]): SyncTombstone[] {
  const byEntity = new Map<string, SyncTombstone>();
  for (const tombstone of tombstones) {
    const key = entityKey(tombstone.entityType, tombstone.entityId);
    const existing = byEntity.get(key);
    if (!existing) {
      byEntity.set(key, tombstone);
      continue;
    }

    const existingDeletedAtMs = Date.parse(existing.deletedAt);
    const nextDeletedAtMs = Date.parse(tombstone.deletedAt);
    const shouldReplace =
      tombstone.version > existing.version ||
      (tombstone.version === existing.version &&
        Number.isFinite(nextDeletedAtMs) &&
        Number.isFinite(existingDeletedAtMs) &&
        nextDeletedAtMs >= existingDeletedAtMs);

    if (shouldReplace) {
      byEntity.set(key, tombstone);
    }
  }
  return Array.from(byEntity.values());
}

function normalizeOutbox(value: unknown): SyncOutboxEvent[] {
  if (!Array.isArray(value)) return [];
  const outbox: SyncOutboxEvent[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<SyncOutboxEvent>;
    if (!isSyncEntityType(candidate.entityType)) continue;
    if (!isSyncOperation(candidate.operation)) continue;
    const id = normalizeString(candidate.id);
    const entityId = normalizeString(candidate.entityId);
    const clientId = normalizeString(candidate.clientId);
    if (!id || !entityId || !clientId) continue;

    const changedAt = isIsoLike(candidate.changedAt) ? candidate.changedAt : new Date().toISOString();

    outbox.push({
      id,
      entityType: candidate.entityType,
      entityId,
      clientId,
      operation: candidate.operation,
      version: normalizeVersion(candidate.version),
      changedAt,
    });
  }

  return dedupeOutbox(outbox);
}

function normalizeTombstones(value: unknown): SyncTombstone[] {
  if (!Array.isArray(value)) return [];
  const tombstones: SyncTombstone[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const candidate = raw as Partial<SyncTombstone>;
    if (!isSyncEntityType(candidate.entityType)) continue;
    const entityId = normalizeString(candidate.entityId);
    const clientId = normalizeString(candidate.clientId);
    const deletedAt = isIsoLike(candidate.deletedAt) ? candidate.deletedAt : null;
    if (!entityId || !clientId || !deletedAt) continue;

    tombstones.push({
      entityType: candidate.entityType,
      entityId,
      clientId,
      version: normalizeVersion(candidate.version),
      deletedAt,
    });
  }

  return dedupeTombstones(tombstones);
}

function normalizeTimestamp(value: unknown, fallbackISO?: string): string {
  if (isIsoLike(value)) return value;
  if (isIsoLike(fallbackISO)) return fallbackISO;
  return new Date().toISOString();
}

function normalizeEntityId(entity: SyncEntitySnapshot): string | null {
  return normalizeString(entity.id);
}

function normalizeClientId(entity: SyncEntitySnapshot): string | null {
  return normalizeString(entity.clientId) ?? normalizeEntityId(entity);
}

export function createEmptySyncState(): SyncState {
  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    outbox: [],
    tombstones: [],
  };
}

export function normalizeSyncState(value: unknown): SyncState {
  if (!value || typeof value !== 'object') {
    return createEmptySyncState();
  }

  const raw = value as Partial<SyncState>;
  const schemaVersion = raw.schemaVersion === SYNC_SCHEMA_VERSION ? SYNC_SCHEMA_VERSION : SYNC_SCHEMA_VERSION;

  return {
    schemaVersion,
    outbox: normalizeOutbox(raw.outbox),
    tombstones: normalizeTombstones(raw.tombstones),
  };
}

export function createSyncEventId(
  entityType: SyncEntityType,
  operation: SyncOperation,
  clientId: string,
  version: number
): string {
  return `${entityType}:${operation}:${clientId}:v${version}`;
}

function queueEvent(events: SyncOutboxEvent[], next: SyncOutboxEvent): SyncOutboxEvent[] {
  const filtered = events.filter(
    (event) => !(event.entityType === next.entityType && event.entityId === next.entityId)
  );
  filtered.push(next);
  return filtered;
}

function removeTombstone(
  tombstones: SyncTombstone[],
  entityType: SyncEntityType,
  entityId: string
): SyncTombstone[] {
  return tombstones.filter((item) => !(item.entityType === entityType && item.entityId === entityId));
}

function upsertTombstone(tombstones: SyncTombstone[], next: SyncTombstone): SyncTombstone[] {
  const without = removeTombstone(tombstones, next.entityType, next.entityId);
  without.push(next);
  return dedupeTombstones(without);
}

export function queueSyncUpsert(
  syncState: SyncState | undefined,
  entityType: SyncEntityType,
  entity: SyncEntitySnapshot
): SyncState {
  const normalized = normalizeSyncState(syncState);
  const entityId = normalizeEntityId(entity);
  const clientId = normalizeClientId(entity);
  if (!entityId || !clientId) return normalized;

  const version = normalizeVersion(entity.version);
  const changedAt = normalizeTimestamp(entity.updatedAt);
  const event: SyncOutboxEvent = {
    id: createSyncEventId(entityType, 'upsert', clientId, version),
    entityType,
    entityId,
    clientId,
    operation: 'upsert',
    version,
    changedAt,
  };

  return {
    ...normalized,
    outbox: queueEvent(normalized.outbox, event),
    tombstones: removeTombstone(normalized.tombstones, entityType, entityId),
  };
}

export function queueSyncDelete(
  syncState: SyncState | undefined,
  entityType: SyncEntityType,
  entity: SyncEntitySnapshot
): SyncState {
  const normalized = normalizeSyncState(syncState);
  const entityId = normalizeEntityId(entity);
  const clientId = normalizeClientId(entity);
  if (!entityId || !clientId) return normalized;

  const version = normalizeVersion(entity.version);
  const deletedAt = normalizeTimestamp(entity.deletedAt, entity.updatedAt);
  const event: SyncOutboxEvent = {
    id: createSyncEventId(entityType, 'delete', clientId, version),
    entityType,
    entityId,
    clientId,
    operation: 'delete',
    version,
    changedAt: deletedAt,
  };

  const tombstone: SyncTombstone = {
    entityType,
    entityId,
    clientId,
    version,
    deletedAt,
  };

  return {
    ...normalized,
    outbox: queueEvent(normalized.outbox, event),
    tombstones: upsertTombstone(normalized.tombstones, tombstone),
  };
}

export function removeSyncTombstone(
  syncState: SyncState | undefined,
  entityType: SyncEntityType,
  entityId: string
): SyncState {
  const normalized = normalizeSyncState(syncState);
  const safeEntityId = normalizeString(entityId);
  if (!safeEntityId) return normalized;

  return {
    ...normalized,
    tombstones: removeTombstone(normalized.tombstones, entityType, safeEntityId),
  };
}

export function getSyncTombstone(
  syncState: SyncState | undefined,
  entityType: SyncEntityType,
  entityId: string
): SyncTombstone | null {
  const normalized = normalizeSyncState(syncState);
  const safeEntityId = normalizeString(entityId);
  if (!safeEntityId) return null;
  return (
    normalized.tombstones.find(
      (item) => item.entityType === entityType && item.entityId === safeEntityId
    ) ?? null
  );
}
