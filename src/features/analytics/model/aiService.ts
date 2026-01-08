import { AppState, Exercise, SetEntry, TrainingBlockId } from '../../workouts/model/types';
import {
  getLastSetForExercise,
  getWorkoutDates,
  getDailyWorkout,
  groupDailySets,
  getSetsForExercise,
} from '../../workouts/model/workoutService';
import type { AppLanguage } from '../../../shared/types';
import { blockLabel } from '../../../shared/i18n/i18n';
import { formatRelativeDayLabel, formatShortDate } from '../../../shared/utils/dateLabels';
import { formatWeight, fromKg, toKg, type MassUnit } from '../../../shared/utils/units';

type DailyGroup = ReturnType<typeof groupDailySets>[number];

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalize(text: string): string {
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/[.,!?;:()\[\]"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value: string): string {
  return normalize(value).replace(/\s+/g, '');
}

function localeForLanguage(language: AppLanguage): string {
  if (language === 'nb') return 'nb-NO';
  if (language === 'es') return 'es-ES';
  return 'en-US';
}

function formatDayLabel(date: Date, language: AppLanguage): string {
  return formatRelativeDayLabel(date, new Date(), language) ?? formatShortDate(date);
}

function extractWeight(question: string): number | null {
  const match = question.match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilos|kilogram|kilograms|lb|lbs|pound|pounds)/i);
  if (!match) return null;
  const v = Number(String(match[1]).replace(',', '.'));
  if (!Number.isFinite(v)) return null;
  const unitToken = String(match[2] ?? '').toLowerCase();
  const unit: MassUnit = unitToken.startsWith('l') || unitToken.startsWith('p') ? 'lb' : 'kg';
  const valueKg = toKg(v, unit);
  return Number.isFinite(valueKg) ? valueKg : null;
}

function parseTimeWindow(question: string, language: AppLanguage): Date | null {
  const q = normalize(question);

  const nb = q.match(/siste\s+(\d+)\s*(dag|dager|uke|uker|maned|maneder|mnd)/);
  const en = q.match(/(?:last|past)\s+(\d+)\s*(day|days|week|weeks|month|months)/);
  const es = q.match(/ultim[oa]s?\s+(\d+)\s*(dia|dias|semana|semanas|mes|meses)/);

  const m = language === 'en' ? en : language === 'es' ? es : nb;
  if (!m) {
    if (language === 'en') {
      if (q.includes('last week') || q.includes('past week')) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d;
      }
      if (q.includes('last month') || q.includes('past month')) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d;
      }
      return null;
    }

    if (language === 'es') {
      if (q.includes('ultima semana') || q.includes('ultimo semana')) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d;
      }
      if (q.includes('ultimo mes') || q.includes('ultima mes')) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d;
      }
      return null;
    }

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
  const unit = String(m[2]);
  if (unit.startsWith('uke') || unit.startsWith('week') || unit.startsWith('semana')) days = num * 7;
  if (unit.startsWith('maned') || unit.startsWith('month') || unit.startsWith('mes')) days = num * 30;

  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function monthNames(language: AppLanguage): Array<[string, number]> {
  if (language === 'en') {
    return [
      ['january', 0],
      ['february', 1],
      ['march', 2],
      ['april', 3],
      ['may', 4],
      ['june', 5],
      ['july', 6],
      ['august', 7],
      ['september', 8],
      ['october', 9],
      ['november', 10],
      ['december', 11],
    ];
  }
  if (language === 'es') {
    return [
      ['enero', 0],
      ['febrero', 1],
      ['marzo', 2],
      ['abril', 3],
      ['mayo', 4],
      ['junio', 5],
      ['julio', 6],
      ['agosto', 7],
      ['septiembre', 8],
      ['octubre', 9],
      ['noviembre', 10],
      ['diciembre', 11],
    ];
  }
  return [
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
}

function monthLabels(language: AppLanguage): string[] {
  if (language === 'en') {
    return [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
  }
  if (language === 'es') {
    return [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];
  }
  return [
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
}

function parseMonth(
  question: string,
  language: AppLanguage
): { month: number; year: number; explicitYear: boolean } | null {
  const q = normalize(question);
  const names = monthNames(language);
  const match = names.find(([name]) => q.includes(name));
  if (!match) return null;

  const yearMatch = q.match(/\b(20\d{2})\b/);
  const explicitYear = Boolean(yearMatch);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
  return { month: match[1], year, explicitYear };
}

function inferBlockIdFromQuestion(question: string, language: AppLanguage): TrainingBlockId | null {
  const q = normalize(question);
  const aliases: Record<AppLanguage, Partial<Record<TrainingBlockId, string[]>>> = {
    nb: {
      chest: ['bryst'],
      shoulders: ['skuldre', 'skulder'],
      back: ['rygg'],
      arms: ['armer', 'arm'],
      core: ['core', 'kjerne', 'mage'],
      legs: ['bein', 'ben'],
      cardio: ['cardio'],
    },
    en: {
      chest: ['chest'],
      shoulders: ['shoulders', 'shoulder'],
      back: ['back'],
      arms: ['arms', 'arm'],
      core: ['core', 'abs'],
      legs: ['legs', 'leg'],
      cardio: ['cardio'],
    },
    es: {
      chest: ['pecho'],
      shoulders: ['hombros', 'hombro'],
      back: ['espalda'],
      arms: ['brazos', 'brazo'],
      core: ['core', 'abdomen', 'abdominales'],
      legs: ['piernas', 'pierna'],
      cardio: ['cardio'],
    },
  };

  const map = aliases[language] ?? aliases.en;
  for (const [blockId, words] of Object.entries(map) as Array<[TrainingBlockId, string[]]>) {
    if (words.some((w) => q.includes(w))) return blockId;
  }
  return null;
}

function formatNumber(language: AppLanguage, value: number): string {
  const formatter = new Intl.NumberFormat(localeForLanguage(language), { maximumFractionDigits: 0 });
  return formatter.format(Math.round(value));
}

function describeWindow(language: AppLanguage, since: Date): string {
  const ms = Date.now() - since.getTime();
  const days = Math.max(1, Math.round(ms / 86400000));
  if (language === 'es') return ` (últimos ${days} días)`;
  if (language === 'en') return ` (last ${days} days)`;
  return ` (siste ${days} dager)`;
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
  blockId: TrainingBlockId | string,
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

function filterSetsSince(sets: SetEntry[], since: Date | null): SetEntry[] {
  if (!since) return sets;
  const limit = since.getTime();
  if (!Number.isFinite(limit)) return sets;
  return sets.filter((s) => {
    const ts = new Date(s.createdAt).getTime();
    return Number.isFinite(ts) && ts >= limit;
  });
}

function countWorkoutDays(sets: SetEntry[]): number {
  const keys = new Set<string>();
  for (const s of sets) {
    if (s.createdAt) keys.add(s.createdAt.slice(0, 10));
  }
  return keys.size;
}

function calcTotalVolume(sets: SetEntry[]): number {
  let total = 0;
  for (const s of sets) {
    if (!Number.isFinite(s.weight) || !Number.isFinite(s.reps)) continue;
    if (s.weight < 0 || s.reps <= 0) continue;
    total += s.weight * s.reps;
  }
  return total;
}

function formatSetLine(language: AppLanguage, set: SetEntry, massUnit: MassUnit, exerciseName?: string): string {
  const base = `${formatWeight(set.weight, massUnit, language)} x ${set.reps} ${
    language === 'es' ? 'reps' : language === 'en' ? 'reps' : 'reps'
  }`;
  const namePart = exerciseName ? `${exerciseName}: ` : '';
  const time = new Date(set.createdAt).toLocaleString(localeForLanguage(language), {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${namePart}${base} (${time})`;
}

export function answerAiQuestion(
  appState: AppState,
  rawQuestion: string,
  contextExerciseId?: string | null
): string {
  const language: AppLanguage = appState.language ?? 'en';
  const massUnit: MassUnit = appState.massUnit ?? 'kg';
  const trimmed = rawQuestion.trim();
  if (!trimmed) {
    if (language === 'es') return 'Escribe una pregunta primero.';
    if (language === 'en') return 'Write a question first.';
    return 'Skriv et spørsmål først.';
  }

  const q = normalize(trimmed);

  if (appState.sets.length === 0) {
    if (language === 'es') return 'Aún no encuentro series registradas.';
    if (language === 'en') return "I can't find any logged sets yet.";
    return 'Jeg finner ingen loggede sett enda.';
  }

  // Siste økt generelt
  if (
    (language === 'nb' &&
      (q.includes('siste okt') || q.includes('forrige okt') || q.includes('hva trente jeg sist') || q.includes('hva gjorde jeg sist'))) ||
    (language === 'en' &&
      (q.includes('last workout') ||
        q.includes('previous workout') ||
        q.includes('what did i do last') ||
        q.includes('what did i do in my last session') ||
        q.includes('what did i do in my last workout'))) ||
    (language === 'es' &&
      (q.includes('ultimo entren') ||
        q.includes('entreno anterior') ||
        q.includes('que hice la ultima vez') ||
        q.includes('que hice en mi ultimo entren') ||
        q.includes('que hice en el ultimo entren')))
  ) {
    const dates = getWorkoutDates(appState);
    if (dates.length === 0) {
      if (language === 'es') return 'Aún no encuentro entrenos.';
      if (language === 'en') return "I can't find any workouts yet.";
      return 'Jeg fant ingen økter enda.';
    }
    const lastDate = dates[0];
    const daySets = getDailyWorkout(appState, lastDate);
    const grouped = groupDailySets(daySets);
    if (grouped.length === 0) {
      if (language === 'es') return 'Aún no encuentro entrenos.';
      if (language === 'en') return "I can't find any workouts yet.";
      return 'Jeg fant ingen økter enda.';
    }

    const headerDate = formatDayLabel(new Date(lastDate), language);
    const atWord = language === 'en' ? 'at' : language === 'es' ? 'a las' : 'kl.';
    const lines = (grouped as DailyGroup[]).map((group) => {
      const blockLabel = group.blockName ? ` (${group.blockName})` : '';
      const setSummary = group.sets
        .map((set: { weight: number; reps: number }) => `${formatWeight(set.weight, massUnit, language)} x ${set.reps}`)
        .join(', ');
      return `- ${group.exerciseName}${blockLabel}: ${setSummary} ${atWord} ${group.time}`;
    });
    if (language === 'es') return `Último entreno registrado (${headerDate}):\n${lines.join('\n')}`;
    if (language === 'en') return `Last logged session (${headerDate}):\n${lines.join('\n')}`;
    return `Siste loggede økt (${headerDate}):\n${lines.join('\n')}`;
  }

  const isWorkoutCountQuery =
    (language === 'nb' && (q.includes('okter') || q.includes('okt'))) ||
    (language === 'en' && (q.includes('workouts') || q.includes('workout') || q.includes('sessions') || q.includes('session'))) ||
    (language === 'es' &&
      (q.includes('entrenos') || q.includes('entreno') || q.includes('entrenamientos') || q.includes('sesiones')));

  // Total volume queries (supports "last 7 days" etc)
  const isVolumeQuery =
    (language === 'nb' && q.includes('volum')) ||
    (language === 'en' && q.includes('volume')) ||
    (language === 'es' && (q.includes('volumen') || q.includes('volume')));

  if (isVolumeQuery) {
    const limit = parseTimeWindow(trimmed, language) ?? (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    })();

    const filtered = filterSetsSince(appState.sets, limit);
    const total = calcTotalVolume(filtered);
    const formatted = formatNumber(language, fromKg(total, massUnit));
    const unit = massUnit;
    const windowLabel = describeWindow(language, limit);

    if (language === 'es') return `Volumen total${windowLabel}: ${formatted} ${unit}`;
    if (language === 'en') return `Total volume${windowLabel}: ${formatted} ${unit}`;
    return `Totalt volum${windowLabel}: ${formatted} ${unit}`;
  }

  // Spørsmål om økter (totalt eller per muskelgruppe)
  if (isWorkoutCountQuery) {
    const blockId = inferBlockIdFromQuestion(trimmed, language);
    const monthInfo = parseMonth(trimmed, language);
    const limit = parseTimeWindow(trimmed, language);

    if (blockId) {
      const count = countWorkoutsForBlock(appState, blockId, monthInfo);
      const yearSuffix = monthInfo?.explicitYear ? ` ${monthInfo.year}` : '';
      const monthLabel = monthInfo
        ? language === 'es'
          ? ` en ${formatMonthLabel(monthInfo.month, language)}${yearSuffix}`
          : language === 'en'
            ? ` in ${formatMonthLabel(monthInfo.month, language)}${yearSuffix}`
            : ` i ${formatMonthLabel(monthInfo.month, language)}${yearSuffix}`
        : '';

      const label = blockLabel(blockId as any, language);
      if (language === 'es') return `Tienes ${count} entrenos de ${label.toLowerCase()}${monthLabel}.`;
      if (language === 'en') return `You have ${count} ${label} sessions${monthLabel}.`;
      return `Du har ${count} økter${monthLabel} for ${label.toLowerCase()}.`;
    }

    const filtered = filterSetsSince(appState.sets, limit);
    const count = countWorkoutDays(filtered);
    const windowLabel = limit ? describeWindow(language, limit) : '';

    if (language === 'es') return `Tienes ${count} entrenos${windowLabel}.`;
    if (language === 'en') return `You have ${count} workouts${windowLabel}.`;
    return `Du har ${count} økter${windowLabel}.`;
  }

  // Finn ovelse
  const exercise = findExerciseFromQuestion(appState, q, contextExerciseId);

  if (
    exercise &&
    (q.includes('siste sett') ||
      q.includes('last set') ||
      q.includes('ultimo set') ||
      q.includes('último set') ||
      q.includes('ultima serie') ||
      q.includes('última serie'))
  ) {
    const sets = getSetsForExercise(appState, exercise.id);
    const last = sets[0];
    if (!last) {
      if (language === 'es') return `No encuentro series para ${exercise.name}.`;
      if (language === 'en') return `I can't find sets for ${exercise.name}.`;
      return `Jeg finner ingen sett for ${exercise.name}.`;
    }
    return formatSetLine(language, last, massUnit, exercise.name);
  }

  if (
    exercise &&
    (q.includes('beste sett') || q.includes('best set') || q.includes('mejor serie') || q.includes('mejor set'))
  ) {
    const sets = getSetsForExercise(appState, exercise.id);
    const best = pickBestSet(sets);
    if (!best) {
      if (language === 'es') return `No encuentro series para ${exercise.name}.`;
      if (language === 'en') return `I can't find sets for ${exercise.name}.`;
      return `Jeg finner ingen sett for ${exercise.name}.`;
    }
    return formatSetLine(language, best, massUnit, exercise.name);
  }

  if (exercise) {
    const exerciseSets = appState.sets
      .filter((s) => s.exerciseId === exercise.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    if (exerciseSets.length === 0) {
      if (language === 'es') return `Aún no hay series registradas para ${exercise.name}.`;
      if (language === 'en') return `No logged sets for ${exercise.name} yet.`;
      return `Ingen loggede sett for ${exercise.name} enda.`;
    }

    // PR / max
    if (
      (language === 'nb' && (q.includes('pr') || q.includes('rekord') || q.includes('max') || q.includes('maks'))) ||
      (language === 'en' && (q.includes('pr') || q.includes('record') || q.includes('best') || q.includes('max'))) ||
      (language === 'es' && (q.includes('pr') || q.includes('record') || q.includes('mejor') || q.includes('max')))
    ) {
      const best = pickBestSet(exerciseSets);
      if (!best) {
        if (language === 'es') return `No tengo series para calcular un máximo en ${exercise.name}.`;
        if (language === 'en') return `No sets to calculate a max for in ${exercise.name}.`;
        return `Ingen sett å beregne maks for i ${exercise.name}.`;
      }
      const label = formatDayLabel(new Date(best.createdAt), language);
      const bestLabel = `${formatWeight(best.weight, massUnit, language)} x ${best.reps}`;
      if (language === 'es') return `Mejor serie en ${exercise.name}: ${bestLabel} (${label}).`;
      if (language === 'en') return `Best set in ${exercise.name}: ${bestLabel} (${label}).`;
      return `Beste sett i ${exercise.name}: ${bestLabel} (${label}).`;
    }

    // Hvor mange reps pa X kg
    if (
      (language === 'nb' && q.includes('hvor mange rep')) ||
      (language === 'en' && (q.includes('how many rep') || q.includes('how many reps'))) ||
      (language === 'es' && (q.includes('cuantas rep') || q.includes('cuantas reps') || q.includes('repeticiones')))
    ) {
      const weight = extractWeight(trimmed);
      if (weight == null) {
        const totalReps = exerciseSets.reduce((sum, s) => sum + s.reps, 0);
        if (language === 'es') return `Tienes ${totalReps} reps totales en ${exercise.name}.`;
        if (language === 'en') return `You have ${totalReps} reps total in ${exercise.name}.`;
        return `Du har totalt ${totalReps} reps i ${exercise.name}.`;
      }

      const limit = parseTimeWindow(trimmed, language);
      const now = new Date();
      const filtered = exerciseSets.filter((s) => {
        if (Math.round(s.weight) !== Math.round(weight)) return false;
        if (!limit) return true;
        return new Date(s.createdAt) >= limit && new Date(s.createdAt) <= now;
      });
      const weightLabel = formatWeight(weight, massUnit, language);

      if (filtered.length === 0) {
        if (language === 'es') return `No encontré series a ${weightLabel} en ${exercise.name} en el período seleccionado.`;
        if (language === 'en') return `I found no sets at ${weightLabel} in ${exercise.name} in the selected time window.`;
        return `Jeg fant ingen sett på ${weightLabel} i ${exercise.name} i valgt tidsrom.`;
      }

      const totalReps = filtered.reduce((sum, s) => sum + s.reps, 0);
      if (language === 'es') return `${totalReps} reps a ${weightLabel} en ${exercise.name}.`;
      if (language === 'en') return `${totalReps} reps at ${weightLabel} in ${exercise.name}.`;
      return `${totalReps} reps på ${weightLabel} i ${exercise.name}.`;
    }

    // Siste sett i ovelsen
    if (
      (language === 'nb' && (q.includes('sist') || q.includes('forrige'))) ||
      (language === 'en' && (q.includes('last') || q.includes('previous'))) ||
      (language === 'es' && (q.includes('ultima') || q.includes('ultimo') || q.includes('anterior')))
    ) {
      const last = getLastSetForExercise(appState, exercise.id);
      if (!last) {
        if (language === 'es') return `Aún no hay series registradas para ${exercise.name}.`;
        if (language === 'en') return `No logged sets for ${exercise.name} yet.`;
        return `Ingen sett for ${exercise.name} enda.`;
      }
      const label = formatDayLabel(new Date(last.createdAt), language);
      const lastLabel = `${formatWeight(last.weight, massUnit, language)} x ${last.reps}`;
      if (language === 'es') return `Última serie registrada en ${exercise.name}: ${lastLabel} (${label}).`;
      if (language === 'en') return `Last logged set in ${exercise.name}: ${lastLabel} (${label}).`;
      return `Sist logget sett i ${exercise.name}: ${lastLabel} (${label}).`;
    }

    // Fallback for ovelse
    const last = getLastSetForExercise(appState, exercise.id);
    if (last) {
      const label = formatDayLabel(new Date(last.createdAt), language);
      const lastLabel = `${formatWeight(last.weight, massUnit, language)} x ${last.reps}`;
      if (language === 'es') return `Última serie en ${exercise.name}: ${lastLabel} (${label}).`;
      if (language === 'en') return `Latest set in ${exercise.name}: ${lastLabel} (${label}).`;
      return `Siste sett i ${exercise.name}: ${lastLabel} (${label}).`;
    }
  }

  if (language === 'es') {
    return 'Puedo bare buscar en tu registro. Por ejemplo: "¿Qué hice en mi último entreno?"';
  }
  if (language === 'en') {
    return 'I can only search your log. For example: "What did I do in my last session?"';
  }
  return 'Jeg kan bare søke i loggen. Prøv for eksempel "Hva gjorde jeg på siste økt?"';
}

function formatMonthLabel(monthIndex: number, language: AppLanguage): string {
  const labels = monthLabels(language);
  return labels[monthIndex] ?? '';
}
