import type { AppState, NoteEntry } from '../../../domain/workouts/types';
import { parseInputToAction } from '../../../domain/quicklog/parseInputToAction';
import { findExerciseByNameOrAlias } from '../../../domain/workouts/workoutService';
import { findExerciseFuzzy } from '../../../domain/quicklog/exerciseLookup';

export type NotesMigrationResult = {
  nextNotes: NoteEntry[];
  logIdsToRemove: string[];
  shouldClearLegacyNotes: boolean;
};

const CARDIO_TOKEN = /\b\d+(?:[.,]\d+)?\s*(km|min)\b/i;

function isCardioLog(text: string, state: AppState): boolean {
  if (!CARDIO_TOKEN.test(text)) return false;
  const prefix = text.split(/\d/)[0]?.trim() ?? '';
  if (!prefix) return false;

  const exact = findExerciseByNameOrAlias(state, prefix);
  const fuzzy = exact ? null : findExerciseFuzzy(state, prefix);
  return Boolean(exact || fuzzy);
}

function normalizeNoteSource(value: unknown, fallback: NoteEntry['source']): NoteEntry['source'] {
  if (value === 'home_notes' || value === 'quicklog' || value === 'other') return value;
  return fallback;
}

function createMigratedNote({
  id,
  text,
  createdAt,
  source,
}: {
  id: string;
  text: string;
  createdAt: string;
  source: NoteEntry['source'];
}): NoteEntry {
  return { id, text, createdAt, source };
}

export function buildNotesMigration(params: {
  appState: AppState;
  existingNotes: NoteEntry[];
}): NotesMigrationResult {
  const { appState, existingNotes } = params;
  const nextNotes = Array.isArray(existingNotes) ? [...existingNotes] : [];
  const noteIds = new Set(nextNotes.map((note) => note.id));
  const logIdsToRemove: string[] = [];

  const language = appState.language ?? 'en';
  const defaultUnit = appState.massUnit ?? 'kg';

  const logs = appState.logs ?? [];
  for (const log of logs) {
    const text = String(log?.text ?? '').trim();
    if (!text) continue;

    const parsed = parseInputToAction(text, { appState, language, defaultUnit });
    if (parsed.kind === 'workout') continue;
    if (isCardioLog(text, appState)) continue;

    const createdAt = typeof log.createdAt === 'string' ? log.createdAt : new Date().toISOString();
    const noteId = `note_migrated_${log.id}`;
    if (!noteIds.has(noteId)) {
      nextNotes.push(
        createMigratedNote({
          id: noteId,
          text,
          createdAt,
          source: 'other',
        })
      );
      noteIds.add(noteId);
    }
    logIdsToRemove.push(log.id);
  }

  const legacyNotes = appState.notes ?? [];
  for (const note of legacyNotes) {
    const text = String(note?.text ?? '').trim();
    if (!text) continue;
    const id = typeof note.id === 'string' ? note.id : '';
    const createdAt = typeof note.createdAt === 'string' ? note.createdAt : new Date().toISOString();
    const source = normalizeNoteSource(note.source, 'home_notes');
    const noteId = id || `note_migrated_${createdAt}`;
    if (noteIds.has(noteId)) continue;
    nextNotes.push(
      createMigratedNote({
        id: noteId,
        text,
        createdAt,
        source,
      })
    );
    noteIds.add(noteId);
  }

  return {
    nextNotes,
    logIdsToRemove,
    shouldClearLegacyNotes: legacyNotes.length > 0,
  };
}
