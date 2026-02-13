import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NoteEntry } from '../../../domain/workouts/types';
import { now } from '../../../shared/time';

const STORAGE_KEY = 'treasy_notes_v1';
const VALID_SOURCES: NoteEntry['source'][] = ['home_notes', 'quicklog', 'other'];

function isValidSource(source: unknown): source is NoteEntry['source'] {
  return VALID_SOURCES.includes(source as NoteEntry['source']);
}

function normalizeNote(note: unknown): NoteEntry | null {
  if (!note || typeof note !== 'object') return null;
  const raw = note as NoteEntry;

  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const text = typeof raw.text === 'string' ? raw.text.trim() : '';
  if (!id || !text) return null;

  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt : new Date(now()).toISOString();
  const source = isValidSource(raw.source) ? raw.source : 'other';

  return {
    id,
    text,
    createdAt,
    source,
  };
}

function normalizeNotes(value: unknown): NoteEntry[] {
  if (!Array.isArray(value)) return [];
  const results: NoteEntry[] = [];
  for (const item of value) {
    const normalized = normalizeNote(item);
    if (normalized) results.push(normalized);
  }
  return results;
}

function makeId(): string {
  return `note_${Math.random().toString(36).slice(2, 10)}_${now().toString(36)}`;
}

export async function listNotes(): Promise<NoteEntry[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const parsed = JSON.parse(json) as unknown;
    return normalizeNotes(parsed);
  } catch (e) {
    console.warn('Failed to load notes', e);
    return [];
  }
}

export async function getLatestNote(): Promise<NoteEntry | null> {
  const notes = await listNotes();
  if (notes.length === 0) return null;

  // `createdAt` is stored as ISO, so string comparison is stable for ordering.
  let latest = notes[0] ?? null;
  for (const note of notes) {
    if (!latest || (note.createdAt ?? '') > (latest.createdAt ?? '')) {
      latest = note;
    }
  }
  return latest;
}

export async function replaceNotes(notes: NoteEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (e) {
    console.warn('Failed to save notes', e);
  }
}

export async function addNote(
  text: string,
  source: NoteEntry['source'],
  options?: { createdAt?: string; id?: string }
): Promise<NoteEntry> {
  const trimmed = text.trim();
  const entry: NoteEntry = {
    id: options?.id ?? makeId(),
    text: trimmed,
    createdAt: options?.createdAt ?? new Date(now()).toISOString(),
    source,
  };

  const current = await listNotes();
  const next = [...current, entry];
  await replaceNotes(next);
  return entry;
}

export async function deleteNote(id: string): Promise<void> {
  if (!id) return;
  const current = await listNotes();
  const next = current.filter((note) => note.id !== id);
  if (next.length === current.length) return;
  await replaceNotes(next);
}

export async function clearAllNotes(): Promise<void> {
  await replaceNotes([]);
}
