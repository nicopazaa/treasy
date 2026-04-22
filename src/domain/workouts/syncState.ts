import type { SyncEntityType, SyncState } from '../../shared/types';
import { normalizeSyncState, queueSyncDelete, queueSyncUpsert } from '../../shared/utils/syncQueue';
import type { AppState } from './types';

type EntityShape = {
  id?: string | null;
  clientId?: string | null;
  version?: number;
  updatedAt?: string;
  deletedAt?: string | null;
};

export function queueAppSyncUpsert(
  state: AppState,
  entityType: SyncEntityType,
  entity: EntityShape
): AppState {
  return {
    ...state,
    sync: queueSyncUpsert(state.sync, entityType, entity),
  };
}

export function queueAppSyncDelete(
  state: AppState,
  entityType: SyncEntityType,
  entity: EntityShape
): AppState {
  return {
    ...state,
    sync: queueSyncDelete(state.sync, entityType, entity),
  };
}

export function queueManyAppSyncUpserts(
  state: AppState,
  entityType: SyncEntityType,
  entities: EntityShape[]
): AppState {
  if (!entities.length) return state;
  let sync: SyncState | undefined = state.sync;
  for (const entity of entities) {
    sync = queueSyncUpsert(sync, entityType, entity);
  }
  return { ...state, sync: sync ?? normalizeSyncState(undefined) };
}

export function queueManyAppSyncDeletes(
  state: AppState,
  entityType: SyncEntityType,
  entities: EntityShape[]
): AppState {
  if (!entities.length) return state;
  let sync: SyncState | undefined = state.sync;
  for (const entity of entities) {
    sync = queueSyncDelete(sync, entityType, entity);
  }
  return { ...state, sync: sync ?? normalizeSyncState(undefined) };
}
