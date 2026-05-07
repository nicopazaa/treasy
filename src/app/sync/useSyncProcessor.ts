import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import type { AppState } from '../../features/workouts';
import {
  acknowledgeNotesSyncEvents,
  discardNotesSyncEvents,
  getNotesSyncSnapshot,
  markNotesSyncStatus,
  subscribeToNotesChanges,
} from '../../features/notes';
import {
  getExpoPublicSyncBatchSize,
  getExpoPublicSyncEndpoint,
  getExpoPublicSyncRetryBaseMs,
  getExpoPublicSyncRetryMaxMs,
  getExpoPublicSyncTimeoutMs,
} from '../../shared/config/env';
import type {
  CardioEntry,
  Exercise,
  LogEntry,
  NoteEntry,
  SetEntry,
} from '../../domain/workouts/types';
import type {
  SyncEntityType,
  SyncOperation,
  SyncOutboxEvent,
  SyncState,
  SyncStatus,
  SyncTombstone,
} from '../../shared/types';
import { normalizeSyncState } from '../../shared/utils/syncQueue';
import type { AppStatePersister } from '../state/persist';

type SyncProcessorConfig = {
  batchSize: number;
  endpoint: string | null;
  retryBaseMs: number;
  retryMaxMs: number;
  timeoutMs: number;
};

type SyncDispatchScope = 'app' | 'notes';

type SyncDispatchItem = {
  deletedAt: string | null;
  event: SyncOutboxEvent;
  payload: Record<string, unknown> | null;
  scope: SyncDispatchScope;
};

type SyncCollection = {
  items: SyncDispatchItem[];
  stale: Array<{ event: SyncOutboxEvent; scope: SyncDispatchScope }>;
};

type SyncTransportEvent = {
  changedAt: string;
  clientId: string;
  deletedAt: string | null;
  entity: Record<string, unknown> | null;
  entityId: string;
  entityType: SyncEntityType;
  id: string;
  operation: SyncOperation;
  version: number;
};

type SyncTransportResponse = {
  acknowledgedEventIds: string[];
};

type SyncableEntity = {
  id: string;
  syncStatus?: SyncStatus;
  version?: number;
};

type EntityUpdater<TEntity extends SyncableEntity> = (entity: TEntity, event: SyncOutboxEvent) => TEntity;

function readSyncProcessorConfig(): SyncProcessorConfig {
  return {
    endpoint: getExpoPublicSyncEndpoint(),
    batchSize: getExpoPublicSyncBatchSize(),
    timeoutMs: getExpoPublicSyncTimeoutMs(),
    retryBaseMs: getExpoPublicSyncRetryBaseMs(),
    retryMaxMs: Math.max(getExpoPublicSyncRetryBaseMs(), getExpoPublicSyncRetryMaxMs()),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeAckIds(raw: unknown, fallbackIds: string[]): string[] {
  if (!isRecord(raw)) return fallbackIds;

  const candidates = [
    raw.acknowledgedEventIds,
    raw.ackedEventIds,
    raw.acknowledged,
    raw.acked,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const ids = candidate
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter((value): value is string => value.length > 0);
    if (ids.length > 0) return ids;
  }

  return fallbackIds;
}

function toTransportEvent(item: SyncDispatchItem): SyncTransportEvent {
  return {
    id: item.event.id,
    entityType: item.event.entityType,
    entityId: item.event.entityId,
    clientId: item.event.clientId,
    operation: item.event.operation,
    version: item.event.version,
    changedAt: item.event.changedAt,
    entity: item.payload,
    deletedAt: item.deletedAt,
  };
}

async function sendSyncBatch(
  config: SyncProcessorConfig,
  appState: AppState,
  authToken: string | null,
  items: SyncDispatchItem[]
): Promise<SyncTransportResponse> {
  const endpoint = config.endpoint;
  if (!endpoint) {
    return { acknowledgedEventIds: [] };
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeoutId = setTimeout(() => {
    controller?.abort();
  }, config.timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({
        schemaVersion: 1,
        userId: appState.userId ?? null,
        sentAt: new Date().toISOString(),
        events: items.map(toTransportEvent),
      }),
      signal: controller?.signal,
    });

    const rawText = await response.text();
    const parsedBody = rawText ? safeParseJson(rawText) : null;

    if (!response.ok) {
      const bodyMessage =
        isRecord(parsedBody) && typeof parsedBody.error === 'string' ? parsedBody.error.trim() : '';
      const message = bodyMessage || `Sync request failed with status ${response.status}`;
      throw new Error(message);
    }

    return {
      acknowledgedEventIds: normalizeAckIds(parsedBody, items.map((item) => item.event.id)),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Sync request timed out after ${config.timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function safeParseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function sortEvents(events: SyncOutboxEvent[]): SyncOutboxEvent[] {
  return events
    .slice()
    .sort((left, right) => {
      if (left.changedAt !== right.changedAt) {
        return left.changedAt < right.changedAt ? -1 : 1;
      }
      return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
}

function removeEventsFromSyncState(syncState: SyncState | undefined, events: SyncOutboxEvent[]): SyncState {
  const normalized = normalizeSyncState(syncState);
  if (!events.length) return normalized;

  const removedEventIds = new Set(events.map((event) => event.id));
  const removedDeletes = new Map<string, SyncOutboxEvent>();
  for (const event of events) {
    if (event.operation !== 'delete') continue;
    removedDeletes.set(`${event.entityType}:${event.entityId}`, event);
  }

  return {
    ...normalized,
    outbox: normalized.outbox.filter((event) => !removedEventIds.has(event.id)),
    tombstones: normalized.tombstones.filter((tombstone) => {
      const matchingDelete = removedDeletes.get(`${tombstone.entityType}:${tombstone.entityId}`);
      if (!matchingDelete) return true;
      return tombstone.version > matchingDelete.version;
    }),
  };
}

function applyStatusToEntity<TEntity extends SyncableEntity>(
  entity: TEntity,
  event: SyncOutboxEvent,
  status: SyncStatus
): TEntity {
  const currentVersion = entity.version ?? 1;
  if (currentVersion !== event.version) return entity;
  if ((entity.syncStatus ?? 'local') === status) return entity;
  return { ...entity, syncStatus: status };
}

function applyAckToEntity<TEntity extends SyncableEntity>(entity: TEntity, event: SyncOutboxEvent): TEntity {
  const currentVersion = entity.version ?? 1;
  if (currentVersion > event.version) return entity;
  if ((entity.syncStatus ?? 'local') === 'synced' && currentVersion === event.version) return entity;
  return { ...entity, syncStatus: 'synced' };
}

function updateCollectionByEvents<TEntity extends SyncableEntity>(
  items: TEntity[] | undefined,
  entityType: SyncEntityType,
  events: SyncOutboxEvent[],
  updater: (entity: TEntity, event: SyncOutboxEvent) => TEntity
): { changed: boolean; items: TEntity[] | undefined } {
  if (!items || items.length === 0) {
    return { changed: false, items };
  }

  const relevantEvents = events.filter((event) => event.entityType === entityType);
  if (!relevantEvents.length) {
    return { changed: false, items };
  }

  const byEntityId = new Map<string, SyncOutboxEvent[]>();
  for (const event of relevantEvents) {
    const bucket = byEntityId.get(event.entityId);
    if (bucket) {
      bucket.push(event);
    } else {
      byEntityId.set(event.entityId, [event]);
    }
  }

  let changed = false;
  const nextItems = items.map((entity) => {
    const entityEvents = byEntityId.get(entity.id);
    if (!entityEvents?.length) return entity;
    let nextEntity = entity;
    for (const event of entityEvents) {
      const updated = updater(nextEntity, event);
      if (updated !== nextEntity) {
        nextEntity = updated;
        changed = true;
      }
    }
    return nextEntity;
  });

  return { changed, items: changed ? nextItems : items };
}

function updateAppStateCollection(
  state: AppState,
  entityType: SyncEntityType,
  events: SyncOutboxEvent[],
  updater: EntityUpdater<SyncableEntity>
): AppState {
  switch (entityType) {
    case 'exercise': {
      const result = updateCollectionByEvents<Exercise>(
        state.exercises,
        entityType,
        events,
        updater as unknown as EntityUpdater<Exercise>
      );
      return result.changed ? { ...state, exercises: result.items ?? [] } : state;
    }
    case 'set': {
      const result = updateCollectionByEvents<SetEntry>(
        state.sets,
        entityType,
        events,
        updater as unknown as EntityUpdater<SetEntry>
      );
      return result.changed ? { ...state, sets: result.items ?? [] } : state;
    }
    case 'cardio': {
      const result = updateCollectionByEvents<CardioEntry>(
        state.cardioEntries,
        entityType,
        events,
        updater as unknown as EntityUpdater<CardioEntry>
      );
      return result.changed ? { ...state, cardioEntries: result.items ?? [] } : state;
    }
    case 'log': {
      const result = updateCollectionByEvents<LogEntry>(
        state.logs ?? [],
        entityType,
        events,
        updater as unknown as EntityUpdater<LogEntry>
      );
      return result.changed ? { ...state, logs: result.items ?? [] } : state;
    }
    case 'note': {
      const result = updateCollectionByEvents<NoteEntry>(
        state.notes ?? [],
        entityType,
        events,
        updater as unknown as EntityUpdater<NoteEntry>
      );
      return result.changed ? { ...state, notes: result.items ?? [] } : state;
    }
    default:
      return state;
  }
}

function markAppSyncStatus(state: AppState, events: SyncOutboxEvent[], status: SyncStatus): AppState {
  let nextState = state;
  for (const entityType of ['exercise', 'set', 'cardio', 'log', 'note'] as SyncEntityType[]) {
    nextState = updateAppStateCollection(nextState, entityType, events, (entity, event) =>
      applyStatusToEntity(entity, event, status)
    );
  }
  return nextState;
}

function acknowledgeAppSyncEvents(state: AppState, events: SyncOutboxEvent[]): AppState {
  let nextState = state;
  for (const entityType of ['exercise', 'set', 'cardio', 'log', 'note'] as SyncEntityType[]) {
    nextState = updateAppStateCollection(nextState, entityType, events, applyAckToEntity);
  }

  const nextSync = removeEventsFromSyncState(nextState.sync, events);
  return nextSync === nextState.sync ? nextState : { ...nextState, sync: nextSync };
}

function discardAppSyncEvents(state: AppState, events: SyncOutboxEvent[]): AppState {
  const nextSync = removeEventsFromSyncState(state.sync, events);
  return nextSync === state.sync ? state : { ...state, sync: nextSync };
}

function getAppEntityPayload(state: AppState, entityType: SyncEntityType, entityId: string): Record<string, unknown> | null {
  if (entityType === 'exercise') {
    return (state.exercises.find((item) => item.id === entityId) ?? null) as Record<string, unknown> | null;
  }
  if (entityType === 'set') {
    return (state.sets.find((item) => item.id === entityId) ?? null) as Record<string, unknown> | null;
  }
  if (entityType === 'cardio') {
    return (state.cardioEntries.find((item) => item.id === entityId) ?? null) as Record<string, unknown> | null;
  }
  if (entityType === 'log') {
    return ((state.logs ?? []).find((item) => item.id === entityId) ?? null) as Record<string, unknown> | null;
  }
  if (entityType === 'note') {
    return ((state.notes ?? []).find((item) => item.id === entityId) ?? null) as Record<string, unknown> | null;
  }
  return null;
}

function getTombstone(syncState: SyncState | undefined, entityType: SyncEntityType, entityId: string): SyncTombstone | null {
  const normalized = normalizeSyncState(syncState);
  return normalized.tombstones.find((item) => item.entityType === entityType && item.entityId === entityId) ?? null;
}

function buildAppDispatchItem(state: AppState, event: SyncOutboxEvent): SyncDispatchItem | null {
  if (event.operation === 'upsert') {
    const payload = getAppEntityPayload(state, event.entityType, event.entityId);
    if (!payload) return null;
    return {
      scope: 'app',
      event,
      payload,
      deletedAt: null,
    };
  }

  const tombstone = getTombstone(state.sync, event.entityType, event.entityId);
  if (!tombstone) return null;
  return {
    scope: 'app',
    event,
    payload: null,
    deletedAt: tombstone.deletedAt,
  };
}

function buildNoteDispatchItem(
  notesSnapshot: Awaited<ReturnType<typeof getNotesSyncSnapshot>>,
  event: SyncOutboxEvent
): SyncDispatchItem | null {
  if (event.operation === 'upsert') {
    const payload = notesSnapshot.notes.find((note) => note.id === event.entityId) ?? null;
    if (!payload) return null;
    return {
      scope: 'notes',
      event,
      payload: payload as unknown as Record<string, unknown>,
      deletedAt: null,
    };
  }

  const tombstone = getTombstone(notesSnapshot.sync, event.entityType, event.entityId);
  if (!tombstone) return null;
  return {
    scope: 'notes',
    event,
    payload: null,
    deletedAt: tombstone.deletedAt,
  };
}

function collectSyncDispatches(
  appState: AppState,
  notesSnapshot: Awaited<ReturnType<typeof getNotesSyncSnapshot>>,
  batchSize: number
): SyncCollection {
  const stale: Array<{ event: SyncOutboxEvent; scope: SyncDispatchScope }> = [];
  const items: SyncDispatchItem[] = [];

  const appEvents = sortEvents(normalizeSyncState(appState.sync).outbox);
  for (const event of appEvents) {
    const item = buildAppDispatchItem(appState, event);
    if (!item) {
      stale.push({ scope: 'app', event });
      continue;
    }
    items.push(item);
  }

  const noteEvents = sortEvents(normalizeSyncState(notesSnapshot.sync).outbox);
  for (const event of noteEvents) {
    const item = buildNoteDispatchItem(notesSnapshot, event);
    if (!item) {
      stale.push({ scope: 'notes', event });
      continue;
    }
    items.push(item);
  }

  items.sort((left, right) => {
    if (left.event.changedAt !== right.event.changedAt) {
      return left.event.changedAt < right.event.changedAt ? -1 : 1;
    }
    return left.event.id < right.event.id ? -1 : left.event.id > right.event.id ? 1 : 0;
  });

  return {
    stale,
    items: items.slice(0, Math.max(1, batchSize)),
  };
}

function splitEventsByScope(items: SyncDispatchItem[]): {
  appEvents: SyncOutboxEvent[];
  noteEvents: SyncOutboxEvent[];
} {
  const appEvents: SyncOutboxEvent[] = [];
  const noteEvents: SyncOutboxEvent[] = [];

  for (const item of items) {
    if (item.scope === 'app') {
      appEvents.push(item.event);
    } else {
      noteEvents.push(item.event);
    }
  }

  return { appEvents, noteEvents };
}

function splitStaleByScope(stale: Array<{ event: SyncOutboxEvent; scope: SyncDispatchScope }>): {
  appEvents: SyncOutboxEvent[];
  noteEvents: SyncOutboxEvent[];
} {
  const appEvents: SyncOutboxEvent[] = [];
  const noteEvents: SyncOutboxEvent[] = [];
  for (const entry of stale) {
    if (entry.scope === 'app') {
      appEvents.push(entry.event);
    } else {
      noteEvents.push(entry.event);
    }
  }
  return { appEvents, noteEvents };
}

export function useSyncProcessor(opts: {
  appState: AppState;
  authToken?: string | null;
  loading: boolean;
  persister: AppStatePersister;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
}): void {
  const { appState, authToken = null, loading, persister, setAppState } = opts;
  const config = useMemo(readSyncProcessorConfig, []);
  const stateRef = useRef(appState);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const rerunRequestedRef = useRef(false);
  const attemptByEventIdRef = useRef(new Map<string, number>());
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    stateRef.current = appState;
  }, [appState]);

  const syncEnabled = Boolean(config.endpoint);
  const appSyncSignature = useMemo(
    () => normalizeSyncState(appState.sync).outbox.map((event) => event.id).join('|'),
    [appState.sync]
  );

  const clearTimer = useCallback(() => {
    if (!timerRef.current) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const commitAppState = useCallback(
    (nextState: AppState) => {
      stateRef.current = nextState;
      setAppState(nextState);
      void persister.saveNow(nextState);
    },
    [persister, setAppState]
  );

  const scheduleRun = useCallback(
    (delayMs: number) => {
      if (!syncEnabled) return;
      if (runningRef.current && delayMs <= 0) {
        rerunRequestedRef.current = true;
        return;
      }

      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        runRef.current();
      }, Math.max(0, delayMs));
    },
    [clearTimer, syncEnabled]
  );

  const executeSyncPass = useCallback(async () => {
    if (!syncEnabled || loading) return;
    if (runningRef.current) {
      rerunRequestedRef.current = true;
      return;
    }

    runningRef.current = true;
    try {
      const currentAppState = stateRef.current;
      const notesSnapshot = await getNotesSyncSnapshot();
      const collection = collectSyncDispatches(currentAppState, notesSnapshot, config.batchSize);

      if (collection.stale.length) {
        const { appEvents, noteEvents } = splitStaleByScope(collection.stale);
        if (appEvents.length) {
          const nextState = discardAppSyncEvents(stateRef.current, appEvents);
          if (nextState !== stateRef.current) {
            commitAppState(nextState);
          }
        }
        if (noteEvents.length) {
          await discardNotesSyncEvents(noteEvents);
        }
      }

      if (!collection.items.length) {
        return;
      }

      const { appEvents, noteEvents } = splitEventsByScope(collection.items);
      if (appEvents.length) {
        const pendingState = markAppSyncStatus(stateRef.current, appEvents, 'pending');
        if (pendingState !== stateRef.current) {
          commitAppState(pendingState);
        }
      }
      if (noteEvents.length) {
        await markNotesSyncStatus(noteEvents, 'pending');
      }

      let maxAttempt = 1;
      for (const item of collection.items) {
        const nextAttempt = (attemptByEventIdRef.current.get(item.event.id) ?? 0) + 1;
        attemptByEventIdRef.current.set(item.event.id, nextAttempt);
        if (nextAttempt > maxAttempt) {
          maxAttempt = nextAttempt;
        }
      }

      try {
        const response = await sendSyncBatch(config, stateRef.current, authToken, collection.items);
        const acknowledgedIds = new Set(response.acknowledgedEventIds);
        const acknowledgedItems = collection.items.filter((item) => acknowledgedIds.has(item.event.id));

        if (!acknowledgedItems.length) {
          throw new Error('Sync endpoint returned success without any acknowledged events');
        }

        const acknowledgedAppEvents = acknowledgedItems
          .filter((item) => item.scope === 'app')
          .map((item) => item.event);
        const acknowledgedNoteEvents = acknowledgedItems
          .filter((item) => item.scope === 'notes')
          .map((item) => item.event);

        if (acknowledgedAppEvents.length) {
          const acknowledgedState = acknowledgeAppSyncEvents(stateRef.current, acknowledgedAppEvents);
          if (acknowledgedState !== stateRef.current) {
            commitAppState(acknowledgedState);
          }
        }
        if (acknowledgedNoteEvents.length) {
          await acknowledgeNotesSyncEvents(acknowledgedNoteEvents);
        }

        for (const eventId of acknowledgedIds) {
          attemptByEventIdRef.current.delete(eventId);
        }

        if (acknowledgedItems.length < collection.items.length) {
          scheduleRun(config.retryBaseMs);
        } else {
          scheduleRun(0);
        }
      } catch (error) {
        console.warn('Sync processor batch failed', error);
        if (appEvents.length) {
          const failedState = markAppSyncStatus(stateRef.current, appEvents, 'failed');
          if (failedState !== stateRef.current) {
            commitAppState(failedState);
          }
        }
        if (noteEvents.length) {
          await markNotesSyncStatus(noteEvents, 'failed');
        }

        const delayMs = Math.min(
          config.retryMaxMs,
          config.retryBaseMs * Math.max(1, 2 ** Math.max(0, maxAttempt - 1))
        );
        scheduleRun(delayMs);
      }
    } finally {
      runningRef.current = false;
      if (rerunRequestedRef.current) {
        rerunRequestedRef.current = false;
        scheduleRun(0);
      }
    }
  }, [authToken, commitAppState, config, loading, scheduleRun, syncEnabled]);

  useEffect(() => {
    runRef.current = () => {
      void executeSyncPass();
    };
  }, [executeSyncPass]);

  useEffect(() => {
    if (!syncEnabled) return;
    if (loading) return;
    scheduleRun(0);
  }, [loading, scheduleRun, syncEnabled]);

  useEffect(() => {
    if (!syncEnabled) return;
    if (loading) return;
    if (!appSyncSignature) return;
    scheduleRun(0);
  }, [appSyncSignature, loading, scheduleRun, syncEnabled]);

  useEffect(() => {
    if (!syncEnabled) return;
    return subscribeToNotesChanges(() => {
      if (loading) return;
      scheduleRun(0);
    });
  }, [loading, scheduleRun, syncEnabled]);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);
}
