import type { AppLanguage } from '../../shared/types';
import type { AppState, Exercise, ExerciseMetadataInput, SetEntry } from '../workouts/types';
import { findExerciseFuzzy } from '../quicklog/exerciseLookup';
import { inferBlockIdFromExercise } from '../quicklog/quickLogService';
import { normalizeExerciseName } from '../workouts/nameNormalize';
import { findExerciseByNameOrAlias } from '../workouts/workoutService';
import { now } from '../../shared/time';
import type { ParsedExerciseChunk, ParsedSet } from './parsePipeline';

// IMPORTANT:
// This module must remain pure and deterministic.
// Never mutate AppState directly; always return new objects/arrays.
export type ApplyResult =
  | { kind: 'applied'; next: AppState }
  | {
      kind: 'needsAliasConfirmation';
      next: AppState;
      candidateExerciseId: string;
      newName: string;
      pendingSets: ParsedSet[];
      blockIdHint?: string;
    }
  | { kind: 'createdExerciseNeedsCategorization'; next: AppState; exerciseId: string };

function splitNameAndCodes(raw: string): { name: string; metadata: ExerciseMetadataInput } {
  const matches = Array.from(raw.matchAll(/\(([^)]+)\)/g))
    .map((m) => (m[1] ?? '').trim())
    .filter(Boolean);
  const name = raw.replace(/\s*\([^)]+\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || raw.trim();
  const [shortCode, ...tags] = matches;
  return {
    name,
    metadata: {
      shortCode: shortCode ?? null,
      tags,
    },
  };
}

function sanitizeLabel(label?: string | null): string | null {
  if (!label) return null;
  const trimmed = String(label).replace(/[()]/g, '').trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

function sanitizeMetadata(metadata?: ExerciseMetadataInput): { shortCode: string | null; tags: string[] } {
  const shortCode = sanitizeLabel(metadata?.shortCode);
  const tags = Array.from(
    new Set(
      (metadata?.tags ?? [])
        .map((tag) => sanitizeLabel(tag))
        .filter((tag): tag is string => Boolean(tag))
    )
  );

  return { shortCode, tags };
}

function makeId(prefix: string, now: number, seq: number): string {
  // Deterministic ID generation for parsing-applied entities.
  return `${prefix}_${now.toString(36)}_${seq.toString(36)}`;
}

function appendParsedSets(
  state: AppState,
  exerciseId: string,
  sets: ParsedSet[],
  createdAtIso: string,
  idBaseSeq: number
): { next: AppState; nextSeq: number } {
  let seq = idBaseSeq;
  const nextSets: SetEntry[] = [];

  for (const s of sets) {
    const weight = s.weight;
    const reps = s.reps;
    if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight < 0 || reps <= 0) continue;

    const isBodyweight = s.isBodyweight === true || weight === 0;
    nextSets.push({
      id: makeId('set', Date.parse(createdAtIso), seq++),
      exerciseId,
      weight,
      reps,
      createdAt: createdAtIso,
      isBodyweight,
      setType: isBodyweight ? 'bodyweight' : 'weighted',
    });
  }

  if (nextSets.length === 0) return { next: state, nextSeq: seq };

  return {
    next: { ...state, sets: [...state.sets, ...nextSets] },
    nextSeq: seq,
  };
}

export function applyParsedChunks(
  state: AppState,
  chunks: ParsedExerciseChunk[],
  opts: {
    language: AppLanguage;
    now?: number;
  }
): ApplyResult {
  const nowMs = typeof opts.now === 'number' ? opts.now : now();
  const createdAtIso = new Date(nowMs).toISOString();

  const allowedBlocks = new Set(state.blocks.map((b) => b.id));
  let next = state;

  let seq = 1;
  let firstCreatedExerciseId: string | null = null;

  for (const chunk of chunks) {
    const rawName = String(chunk.rawExerciseName ?? '').trim();
    if (!rawName) continue;
    const sets = Array.isArray(chunk.sets) ? chunk.sets : [];
    if (sets.length === 0) continue;

    const { name: parsedName, metadata } = splitNameAndCodes(rawName);
    const lookupName = parsedName || rawName;

    const exact =
      findExerciseByNameOrAlias(next, rawName) ??
      (lookupName !== rawName ? findExerciseByNameOrAlias(next, lookupName) : null);

    const matched =
      exact ??
      findExerciseFuzzy(next, rawName) ??
      (lookupName !== rawName ? findExerciseFuzzy(next, lookupName) : null);

    if (matched) {
      const appended = appendParsedSets(next, matched.id, sets, createdAtIso, seq);
      next = appended.next;
      seq = appended.nextSeq;
      continue;
    }

    const inferredBlock =
      inferBlockIdFromExercise(rawName) ?? (lookupName !== rawName ? inferBlockIdFromExercise(lookupName) : null);
    const targetBlock =
      (inferredBlock && allowedBlocks.has(inferredBlock) ? inferredBlock : null) ?? next.blocks[0]?.id ?? 'chest';

    const meta = sanitizeMetadata(metadata);
    const exerciseId = makeId('ex', nowMs, seq++);

    const exercise: Exercise = {
      id: exerciseId,
      blockId: targetBlock,
      name: lookupName.trim(),
      shortCode: meta.shortCode ?? undefined,
      tags: meta.tags,
      isCustom: true,
      aliases: [],
      canonicalName: normalizeExerciseName(lookupName),
    };

    next = { ...next, exercises: [...next.exercises, exercise] };

    const appended = appendParsedSets(next, exerciseId, sets, createdAtIso, seq);
    next = appended.next;
    seq = appended.nextSeq;

    if (!firstCreatedExerciseId) firstCreatedExerciseId = exerciseId;
  }

  if (firstCreatedExerciseId) {
    return { kind: 'createdExerciseNeedsCategorization', next, exerciseId: firstCreatedExerciseId };
  }

  return { kind: 'applied', next };
}
