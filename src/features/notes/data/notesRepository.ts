import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SyncOutboxEvent, SyncState, SyncStatus } from '../../../shared/types';
import type { NoteEntry } from '../../../domain/workouts/types';
import { now } from '../../../shared/time';
import { createStableId } from '../../../shared/utils/id';
import { createSyncFields, markSyncDeleted, touchSyncFields, withSyncDefaults } from '../../../shared/utils/syncMeta';
import {
  createEmptySyncState,
  getSyncTombstone,
  normalizeSyncState,
  queueSyncDelete,
  queueSyncUpsert,
} from '../../../shared/utils/syncQueue';

const STORAGE_KEY = 'treasy_notes_v1';
const VALID_SOURCES: NoteEntry['source'][] = ['home_notes', 'quicklog', 'other'];
const NOTES_SCHEMA_VERSION = 1 as const;
const noteListeners = new Set<() => void>();

type NotesStorageEnvelope = {
  schemaVersion: 1;
  notes: NoteEntry[];
  sync: SyncState;
};

export type NotesSyncSnapshot = {
  notes: NoteEntry[];
  sync: SyncState;
};

function isValidSource(source: unknown): source is NoteEntry['source'] {
  return VALID_SOURCES.includes(source as NoteEntry['source']);
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function normalizeNote(note: unknown): NoteEntry | null {
  if (!note || typeof note !== 'object') return null;
  const raw = note as NoteEntry;

  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!id || !text) return null;

  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date(now()).toISOString();
  const source = isValidSource(raw.source) ? raw.source : 'other';

  return withSyncDefaults(
    {
      ...raw,
      id,
      text,
      createdAt,
      source,
    },
    'note',
    createdAt
  );
}

function normalizeNotes(value: unknown): NoteEntry[] {
  if (!Array.isArray(value)) return [];
  const results: NoteEntry[] = [];
  for (const item of value) {
    const normalized = normalizeNote(item);
    if (!normalized) continue;
    if (normalized.deletedAt) continue;
    results.push(normalized);
  }
  return results;
}

function makeId(): string {
  return createStableId('note', now());
}

function hasNoteContentChanges(prev: NoteEntry, next: NoteEntry): boolean {
  return (
    prev.text !== next.text ||
    prev.source !== next.source ||
    prev.createdAt !== next.createdAt
  );
}

function toEnvelope(value: unknown): NotesStorageEnvelope {
  if (!value) {
    return {
      schemaVersion: NOTES_SCHEMA_VERSION,
      notes: [],
      sync: createEmptySyncState(),
    };
  }

  if (Array.isArray(value)) {
    return {
      schemaVersion: NOTES_SCHEMA_VERSION,
      notes: normalizeNotes(value),
      sync: createEmptySyncState(),
    };
  }

  if (typeof value !== 'object') {
    return {
      schemaVersion: NOTES_SCHEMA_VERSION,
      notes: [],
      sync: createEmptySyncState(),
    };
  }

  const raw = value as Partial<NotesStorageEnvelope> & { notes?: unknown; sync?: unknown };
  const sync = normalizeSyncState(raw.sync);
  const notes = normalizeNotes(raw.notes);

  return {
    schemaVersion: NOTES_SCHEMA_VERSION,
    notes,
    sync,
  };
}

async function loadEnvelope(): Promise<NotesStorageEnvelope> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return toEnvelope(parseJson(json));
  } catch (e) {
    console.warn('Failed to load notes', e);
    return {
      schemaVersion: NOTES_SCHEMA_VERSION,
      notes: [],
      sync: createEmptySyncState(),
    };
  }
}

async function saveEnvelope(envelope: NotesStorageEnvelope): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: NOTES_SCHEMA_VERSION,
        notes: envelope.notes,
        sync: normalizeSyncState(envelope.sync),
      } satisfies NotesStorageEnvelope)
    );
    for (const listener of noteListeners) {
      listener();
    }
  } catch (e) {
    console.warn('Failed to save notes', e);
  }
}

function removeAckedEvents(sync: SyncState, events: SyncOutboxEvent[]): SyncState {
  if (!events.length) return normalizeSyncState(sync);
  const ackedIds = new Set(events.map((event) => event.id));
  const ackedDeletes = new Map<string, SyncOutboxEvent>();
  for (const event of events) {
    if (event.operation !== 'delete') continue;
    ackedDeletes.set(event.entityId, event);
  }

  const normalized = normalizeSyncState(sync);
  return {
    ...normalized,
    outbox: normalized.outbox.filter((event) => !ackedIds.has(event.id)),
    tombstones: normalized.tombstones.filter((tombstone) => {
      const matchingDelete = ackedDeletes.get(tombstone.entityId);
      if (!matchingDelete) return true;
      if (matchingDelete.entityType !== tombstone.entityType) return true;
      return tombstone.version > matchingDelete.version;
    }),
  };
}

function applyStatusToNote(note: NoteEntry, event: SyncOutboxEvent, status: SyncStatus): NoteEntry {
  const currentVersion = note.version ?? 1;
  if (currentVersion !== event.version) return note;
  if ((note.syncStatus ?? 'local') === status) return note;
  return { ...note, syncStatus: status };
}

function applyAckToNote(note: NoteEntry, event: SyncOutboxEvent): NoteEntry {
  const currentVersion = note.version ?? 1;
  if (currentVersion > event.version) return note;
  if ((note.syncStatus ?? 'local') === 'synced' && currentVersion === event.version) return note;
  return { ...note, syncStatus: 'synced' };
}

export function subscribeToNotesChanges(listener: () => void): () => void {
  noteListeners.add(listener);
  return () => {
    noteListeners.delete(listener);
  };
}

export async function listNotes(): Promise<NoteEntry[]> {
  const envelope = await loadEnvelope();
  return envelope.notes.slice();
}

export async function getNotesSyncState(): Promise<SyncState> {
  const envelope = await loadEnvelope();
  return normalizeSyncState(envelope.sync);
}

export async function getNotesSyncSnapshot(): Promise<NotesSyncSnapshot> {
  const envelope = await loadEnvelope();
  return {
    notes: envelope.notes.slice(),
    sync: normalizeSyncState(envelope.sync),
  };
}

export async function getLatestNote(): Promise<NoteEntry | null> {
  const notes = await listNotes();
  if (notes.length === 0) return null;

  let latest = notes[0] ?? null;
  for (const note of notes) {
    if (!latest || (note.createdAt ?? '') > (latest.createdAt ?? '')) {
      latest = note;
    }
  }
  return latest;
}

export async function replaceNotes(notes: NoteEntry[]): Promise<void> {
  const envelope = await loadEnvelope();
  const previousById = new Map(envelope.notes.map((note) => [note.id, note] as const));
  const seenIds = new Set<string>();
  const nextNotes: NoteEntry[] = [];
  let nextSync = envelope.sync;

  for (const rawNote of notes) {
    const normalizedInput = normalizeNote(rawNote);
    if (!normalizedInput) continue;
    if (seenIds.has(normalizedInput.id)) continue;
    seenIds.add(normalizedInput.id);

    const previous = previousById.get(normalizedInput.id) ?? null;
    const tombstone = getSyncTombstone(nextSync, 'note', normalizedInput.id);
    let nextNote: NoteEntry;
    let changed = false;

    if (previous) {
      const mergedCandidate = {
        ...previous,
        text: normalizedInput.text,
        source: normalizedInput.source,
        createdAt: normalizedInput.createdAt,
      };

      if (hasNoteContentChanges(previous, mergedCandidate)) {
        nextNote = touchSyncFields(mergedCandidate);
        changed = true;
      } else {
        nextNote = previous;
      }
    } else {
      nextNote = withSyncDefaults(normalizedInput, 'note', normalizedInput.createdAt);
      if (tombstone && tombstone.version >= (nextNote.version ?? 1)) {
        const restoredAt = new Date(now()).toISOString();
        nextNote = {
          ...nextNote,
          version: tombstone.version + 1,
          updatedAt: restoredAt,
          deletedAt: null,
          syncStatus: 'local',
        };
      }
      changed = true;
    }

    nextNotes.push(nextNote);
    if (changed) {
      nextSync = queueSyncUpsert(nextSync, 'note', nextNote);
    }
  }

  for (const previous of envelope.notes) {
    if (seenIds.has(previous.id)) continue;
    const deleted = markSyncDeleted(previous);
    nextSync = queueSyncDelete(nextSync, 'note', deleted);
  }

  await saveEnvelope({
    schemaVersion: NOTES_SCHEMA_VERSION,
    notes: nextNotes,
    sync: nextSync,
  });
}

export async function addNote(
  text: string,
  source: NoteEntry['source'],
  options?: { createdAt?: string; id?: string }
): Promise<NoteEntry> {
  const trimmed = text.trim();
  const createdAt = options?.createdAt ?? new Date(now()).toISOString();
  const entry: NoteEntry = {
    id: options?.id ?? makeId(),
    ...createSyncFields('note', createdAt),
    text: trimmed,
    createdAt,
    source,
  };

  const envelope = await loadEnvelope();
  const tombstone = getSyncTombstone(envelope.sync, 'note', entry.id);
  let normalizedEntry = withSyncDefaults(entry, 'note', entry.createdAt);
  if (tombstone && tombstone.version >= (normalizedEntry.version ?? 1)) {
    const restoredAt = new Date(now()).toISOString();
    normalizedEntry = {
      ...normalizedEntry,
      version: tombstone.version + 1,
      updatedAt: restoredAt,
      deletedAt: null,
      syncStatus: 'local',
    };
  }

  const current = envelope.notes.filter((note) => note.id !== normalizedEntry.id);
  const nextNotes = [...current, normalizedEntry];
  const nextSync = queueSyncUpsert(envelope.sync, 'note', normalizedEntry);

  await saveEnvelope({
    schemaVersion: NOTES_SCHEMA_VERSION,
    notes: nextNotes,
    sync: nextSync,
  });
  return normalizedEntry;
}

export async function deleteNote(id: string): Promise<void> {
  if (!id) return;

  const envelope = await loadEnvelope();
  const target = envelope.notes.find((note) => note.id === id);
  if (!target) return;

  const deleted = markSyncDeleted(target);
  const nextNotes = envelope.notes.filter((note) => note.id !== id);
  const nextSync = queueSyncDelete(envelope.sync, 'note', deleted);
  await saveEnvelope({
    schemaVersion: NOTES_SCHEMA_VERSION,
    notes: nextNotes,
    sync: nextSync,
  });
}

export async function clearAllNotes(): Promise<void> {
  const envelope = await loadEnvelope();
  if (!envelope.notes.length) return;

  let nextSync = envelope.sync;
  for (const note of envelope.notes) {
    const deleted = markSyncDeleted(note);
    nextSync = queueSyncDelete(nextSync, 'note', deleted);
  }

  await saveEnvelope({
    schemaVersion: NOTES_SCHEMA_VERSION,
    notes: [],
    sync: nextSync,
  });
}

export async function markNotesSyncStatus(events: SyncOutboxEvent[], status: SyncStatus): Promise<void> {
  if (!events.length) return;
  const envelope = await loadEnvelope();
  const eventsById = new Map(events.map((event) => [event.id, event] as const));
  let changed = false;

  const nextNotes = envelope.notes.map((note) => {
    let nextNote = note;
    for (const event of eventsById.values()) {
      if (event.entityType !== 'note' || event.entityId !== note.id) continue;
      const updated = applyStatusToNote(nextNote, event, status);
      if (updated !== nextNote) {
        nextNote = updated;
        changed = true;
      }
    }
    return nextNote;
  });

  if (!changed) return;
  await saveEnvelope({
    schemaVersion: NOTES_SCHEMA_VERSION,
    notes: nextNotes,
    sync: normalizeSyncState(envelope.sync),
  });
}

export async function acknowledgeNotesSyncEvents(events: SyncOutboxEvent[]): Promise<void> {
  const noteEvents = events.filter((event) => event.entityType === 'note');
  if (!noteEvents.length) return;

  const envelope = await loadEnvelope();
  const nextSync = removeAckedEvents(envelope.sync, noteEvents);
  const noteEventsById = new Map(noteEvents.map((event) => [event.id, event] as const));
  let changed = false;

  const nextNotes = envelope.notes.map((note) => {
    let nextNote = note;
    for (const event of noteEventsById.values()) {
      if (event.operation !== 'upsert' || event.entityId !== note.id) continue;
      const updated = applyAckToNote(nextNote, event);
      if (updated !== nextNote) {
        nextNote = updated;
        changed = true;
      }
    }
    return nextNote;
  });

  const syncChanged =
    nextSync.outbox.length !== envelope.sync.outbox.length ||
    nextSync.tombstones.length !== envelope.sync.tombstones.length;

  if (!changed && !syncChanged) return;
  await saveEnvelope({
    schemaVersion: NOTES_SCHEMA_VERSION,
    notes: nextNotes,
    sync: nextSync,
  });
}

export async function discardNotesSyncEvents(events: SyncOutboxEvent[]): Promise<void> {
  const noteEvents = events.filter((event) => event.entityType === 'note');
  if (!noteEvents.length) return;

  const envelope = await loadEnvelope();
  const nextSync = removeAckedEvents(envelope.sync, noteEvents);
  const syncChanged =
    nextSync.outbox.length !== envelope.sync.outbox.length ||
    nextSync.tombstones.length !== envelope.sync.tombstones.length;

  if (!syncChanged) return;
  await saveEnvelope({
    schemaVersion: NOTES_SCHEMA_VERSION,
    notes: envelope.notes,
    sync: nextSync,
  });
}
