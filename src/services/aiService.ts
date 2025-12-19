import { AppState, Exercise, SetEntry } from '../types';
import {
  getLastSetForExercise,
  getWorkoutDates,
  getDailyWorkout,
} from './workoutService';
import { formatRelativeDayLabel, formatShortDate } from '../utils/dateLabels';
import { inferBlockIdFromExercise } from './quickLogService';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()\[\]"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value: string): string {
  return normalize(value).replace(/\s+/g, '');
}

function formatDayLabel(date: Date): string {
  return formatRelativeDayLabel(date) ?? formatShortDate(date);
}

function extractWeight(question: string): number | null {
  const match = question.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram)/i);
  if (!match) return null;
  const v = Number(String(match[1]).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

function parseTimeWindow(question: string): Date | null {
  const q = normalize(question);
  const m = q.match(/siste\s+(\d+)\s*(dag|dager|uke|uker|maned|maneder)/);
  if (!m) {
    if (q.includes('siste uke')) {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (q.includes('siste maned')) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    }
    return null;
  }

  const num = Number(m[1]);
  let days = num;
  if (m[2].startsWith('uke')) days = num * 7;
  if (m[2].startsWith('maned')) days = num * 30;

  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function parseMonth(question: string): { month: number; year: number } | null {
  const q = normalize(question);
  const monthNames: Array<[string, number]> = [
    ['januar', 0],
    ['februar', 1],
    ['mars', 2],
    ['april', 3],
    ['mai', 4],
    ['juni', 5],
    ['juli', 6],
    ['august', 7],
    ['september', 8],
    ['oktober', 9],
    ['november', 10],
    ['desember', 11],
  ];

  const match = monthNames.find(([name]) => q.includes(name));
  if (!match) return null;

  const yearMatch = q.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
  return { month: match[1], year };
}

function findExerciseFromQuestion(
  appState: AppState,
  question: string,
  contextExerciseId?: string | null
): Exercise | null {
  if (contextExerciseId) {
    const ex = appState.exercises.find((e) => e.id === contextExerciseId);
    if (ex) return ex;
  }

  const qNorm = normalizeName(question);
  if (!qNorm) return null;

  let best: { ex: Exercise; score: number } | null = null;
  for (const ex of appState.exercises) {
    const nameNorm = normalizeName(ex.name);
    if (!nameNorm) continue;

    let score = 0;
    if (qNorm.includes(nameNorm) || nameNorm.includes(qNorm)) {
      score = 1;
    } else {
      score = nameNorm.length > 0 ? nameNorm.length / qNorm.length : 0;
    }

    if (!best || score > best.score) {
      best = { ex, score };
    }
  }

  if (best && best.score >= 0.55) {
    return best.ex;
  }

  return null;
}

function pickBestSet(sets: SetEntry[]): SetEntry | null {
  if (sets.length === 0) return null;
  return sets.reduce<SetEntry | null>((best, current) => {
    if (!best) return current;
    if (current.weight > best.weight) return current;
    if (current.weight < best.weight) return best;
    if (current.reps > best.reps) return current;
    if (current.reps < best.reps) return best;
    return current.createdAt > best.createdAt ? current : best;
  }, null);
}

function countWorkoutsForBlock(
  appState: AppState,
  blockId: string,
  monthInfo?: { month: number; year: number } | null
): number {
  const dates = new Set<string>();
  for (const s of appState.sets) {
    const exercise = appState.exercises.find((e) => e.id === s.exerciseId);
    if (!exercise || exercise.blockId !== blockId) continue;
    const d = new Date(s.createdAt);
    if (monthInfo) {
      if (d.getMonth() !== monthInfo.month || d.getFullYear() !== monthInfo.year) continue;
    }
    dates.add(s.createdAt.slice(0, 10));
  }
  return dates.size;
}

export function answerAiQuestion(
  appState: AppState,
  rawQuestion: string,
  contextExerciseId?: string | null
): string {
  const trimmed = rawQuestion.trim();
  if (!trimmed) {
    return 'Lokalt svar: Skriv inn et sok, for eksempel "Hva tok jeg sist i benk?"';
  }

  const q = normalize(trimmed);

  if (appState.sets.length === 0) {
    return 'Lokalt svar: Jeg finner ingen loggede sett enda.';
  }

  // Siste okt generelt
  if (
    q.includes('siste okt') ||
    q.includes('forrige okt') ||
    q.includes('hva trente jeg sist') ||
    q.includes('hva gjorde jeg sist')
  ) {
    const dates = getWorkoutDates(appState);
    if (dates.length === 0) {
      return 'Lokalt svar: Jeg fant ingen okter enda.';
    }
    const lastDate = dates[0];
    const daySets = getDailyWorkout(appState, lastDate);
    const headerDate = formatDayLabel(new Date(lastDate));
    const lines = daySets.map(
      (s) =>
        `- ${s.exerciseName}${s.blockName ? ` (${s.blockName})` : ''}: ${s.weight} kg x ${s.reps} reps kl. ${s.time}`
    );
    return `Lokalt svar: Siste loggede okt (${headerDate}):\n${lines.join('\n')}`;
  }

  // Sporsmal om okter per blokk
  if (q.includes('okter') || q.includes('okt')) {
    const blockId = inferBlockIdFromExercise(q);
    if (blockId) {
      const monthInfo = parseMonth(q);
      const count = countWorkoutsForBlock(appState, blockId, monthInfo);
      const monthLabel = monthInfo
        ? ` i ${formatMonthLabel(monthInfo.month)} ${monthInfo.year}`
        : '';
      return `Lokalt svar: Du har ${count} okter${monthLabel} i denne blokken.`;
    }
  }

  // Finn ovelse
  const exercise = findExerciseFromQuestion(appState, q, contextExerciseId);

  if (exercise) {
    const exerciseSets = appState.sets
      .filter((s) => s.exerciseId === exercise.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    if (exerciseSets.length === 0) {
      return `Lokalt svar: Ingen loggede sett for ${exercise.name} enda.`;
    }

    // PR / max
    if (q.includes('pr') || q.includes('rekord') || q.includes('max') || q.includes('maks')) {
      const best = pickBestSet(exerciseSets);
      if (!best) {
        return `Lokalt svar: Ingen sett a beregne max for i ${exercise.name}.`;
      }
      const label = formatDayLabel(new Date(best.createdAt));
      return `Lokalt svar: Beste sett i ${exercise.name} er ${best.weight} kg x ${best.reps} (${label}).`;
    }

    // Hvor mange reps pa X kg
    if (q.includes('hvor mange rep')) {
      const weight = extractWeight(trimmed);
      if (weight == null) {
        const totalReps = exerciseSets.reduce((sum, s) => sum + s.reps, 0);
        return `Lokalt svar: Du har totalt ${totalReps} reps i ${exercise.name}.`;
      }

      const limit = parseTimeWindow(trimmed);
      const now = new Date();
      const filtered = exerciseSets.filter((s) => {
        if (Math.round(s.weight) !== Math.round(weight)) return false;
        if (!limit) return true;
        return new Date(s.createdAt) >= limit && new Date(s.createdAt) <= now;
      });

      if (filtered.length === 0) {
        return `Lokalt svar: Jeg fant ingen sett pa ${weight} kg i ${exercise.name} i valgt tidsrom.`;
      }

      const totalReps = filtered.reduce((sum, s) => sum + s.reps, 0);
      return `Lokalt svar: ${totalReps} reps pa ${weight} kg i ${exercise.name}.`;
    }

    // Siste sett i ovelsen
    if (q.includes('sist') || q.includes('forrige')) {
      const last = getLastSetForExercise(appState, exercise.id);
      if (!last) {
        return `Lokalt svar: Ingen sett for ${exercise.name} enda.`;
      }
      const label = formatDayLabel(new Date(last.createdAt));
      return `Lokalt svar: Sist logget sett i ${exercise.name} var ${last.weight} kg x ${last.reps} (${label}).`;
    }

    // Fallback for ovelse
    const last = getLastSetForExercise(appState, exercise.id);
    if (last) {
      const label = formatDayLabel(new Date(last.createdAt));
      return `Lokalt svar: Siste sett i ${exercise.name} var ${last.weight} kg x ${last.reps} (${label}).`;
    }
  }

  return 'Lokalt svar: Jeg kan bare soke i loggen. Proev for eksempel "Hva tok jeg sist i benk?"';
}

function formatMonthLabel(monthIndex: number): string {
  const labels = [
    'januar',
    'februar',
    'mars',
    'april',
    'mai',
    'juni',
    'juli',
    'august',
    'september',
    'oktober',
    'november',
    'desember',
  ];
  return labels[monthIndex] ?? '';
}
