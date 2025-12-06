import { AppState, Exercise, SetEntry } from '../types';
import {
  getLastSetForExercise,
  getWorkoutDates,
  getDailyWorkout,
} from './workoutService';

// --- Teksthjelpere ---

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:()\[\]"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// veldig enkel Levenshtein for å tåle skrivefeil
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

// --- Parse vekt & tidsrom ---

function extractWeight(question: string): number | null {
  const match = question.match(/(\d+)\s*(kg|kilo|kilogram)/i);
  if (!match) return null;
  const v = Number(match[1]);
  return Number.isFinite(v) ? v : null;
}

function parseTimeWindow(question: string): Date | null {
  const q = normalize(question);
  const m = q.match(/siste\s+(\d+)\s*(dag|dager|uke|uker|måned|måneder)/);
  if (!m) {
    if (q.includes('siste uke')) {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (q.includes('siste måned')) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d;
    }
    return null;
  }

  const num = Number(m[1]);
  let days = num;
  if (m[2].startsWith('uke')) days = num * 7;
  if (m[2].startsWith('måned')) days = num * 30;

  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// --- Finn øvelse basert på tekst + evt. valgt øvelse ---

function findExerciseFromQuestion(
  appState: AppState,
  question: string,
  contextExerciseId?: string | null
): Exercise | null {
  if (contextExerciseId) {
    const ex = appState.exercises.find((e) => e.id === contextExerciseId);
    if (ex) return ex;
  }

  const qNorm = normalize(question);
  if (!qNorm) return null;

  let best: { ex: Exercise; score: number } | null = null;
  for (const ex of appState.exercises) {
    const nameNorm = normalize(ex.name);
    if (!nameNorm) continue;

    // både substring og fuzzy-score
    let score = 0;
    if (qNorm.includes(nameNorm) || nameNorm.includes(qNorm)) {
      score = 1;
    } else {
      score = similarity(qNorm, nameNorm);
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

// --- 1RM-estimat ---

function estimateOneRm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  const est = weight * (1 + reps / 30);
  return Math.round(est * 10) / 10;
}

// --- Hoved-API ---

export function answerAiQuestion(
  appState: AppState,
  rawQuestion: string,
  contextExerciseId?: string | null
): string {
  const trimmed = rawQuestion.trim();
  if (!trimmed) {
    return 'Skriv inn et spørsmål, for eksempel: "Hva tok jeg sist i benkpress?"';
  }

  const q = normalize(trimmed);

  // Smalltalk / generelle spørsmål
  if (
    q.includes('hvordan har du det') ||
    q.includes('går det bra') ||
    q.includes('hvordan går det') ||
    q.includes('hva skjer')
  ) {
    return 'Jeg har det bra – jeg lever av settene dine. Fortsett å logge øktene dine, så holder jeg styr på progresjonen for deg 💪';
  }

  if (q.includes('hvem er du') || q.includes('hva er du')) {
    return 'Jeg er Treasy sin lokale treningsassistent. Jeg ligger kun på denne enheten og bruker loggen din til å svare på spørsmål om øktene dine.';
  }

  if (q.includes('takk') || q.includes('thanks')) {
    return 'Bare hyggelig! Gi meg mer data, så gir jeg deg mer innsikt 😉';
  }

  // Hvis ingen sett finnes i det hele tatt
  if (appState.sets.length === 0) {
    return 'Jeg finner ingen økter enda. Logg noen sett først, så kan jeg svare deg på progresjon, PR og historikk.';
  }

  // Spørsmål om siste økt generelt
  if (
    q.includes('siste økt') ||
    q.includes('forrige økt') ||
    q.includes('hva trente jeg sist') ||
    q.includes('hva gjorde jeg sist')
  ) {
    const dates = getWorkoutDates(appState);
    if (dates.length === 0) {
      return 'Jeg fant ingen økter enda. Logg en økt, så kan jeg vise deg hva du gjorde sist.';
    }
    const lastDate = dates[0];
    const daySets = getDailyWorkout(appState, lastDate);
    const headerDate = new Date(lastDate).toLocaleDateString('nb-NO', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const lines = daySets.map(
      (s) =>
        `• ${s.exerciseName}${s.blockName ? ` (${s.blockName})` : ''}: ${s.weight} kg x ${s.reps} reps kl. ${s.time}`
    );
    return `Dette gjorde du på siste loggede økt (${headerDate}):\n\n${lines.join(
      '\n'
    )}`;
  }

  // Finne øvelse
  const exercise = findExerciseFromQuestion(appState, q, contextExerciseId);

  // Hvis vi ikke klarer å finne øvelse, fall tilbake til siste sett totalt
  if (!exercise) {
    const lastOverall = [...appState.sets].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : -1
    )[0];
    if (!lastOverall) {
      return 'Jeg fant ingen økter ennå.';
    }
    const ex = appState.exercises.find((e) => e.id === lastOverall.exerciseId);
    const dt = new Date(lastOverall.createdAt);
    const dateLabel = dt.toLocaleDateString('nb-NO');
    const timeLabel = dt.toLocaleTimeString('nb-NO', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return (
      'Jeg er litt usikker på hvilken øvelse du mener, men i din siste loggede økt tok du:\n\n' +
      `${ex ? ex.name : 'Ukjent øvelse'}: ${lastOverall.weight} kg x ${
        lastOverall.reps
      } reps (${dateLabel}, ${timeLabel}).`
    );
  }

  // Spesifikk øvelse
  const exerciseSets = appState.sets
    .filter((s) => s.exerciseId === exercise.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  if (exerciseSets.length === 0) {
    return `Jeg har ingen loggede sett for ${exercise.name} enda.`;
  }

  // 1) PR / max-spørsmål
  if (
    q.includes('pr') ||
    q.includes('personlig rekord') ||
    q.includes('rekord') ||
    q.includes('max') ||
    q.includes('maks')
  ) {
    let best: SetEntry | null = null;
    for (const s of exerciseSets) {
      if (!best) {
        best = s;
      } else if (s.weight > best.weight) {
        best = s;
      } else if (s.weight === best.weight && s.reps > best.reps) {
        best = s;
      }
    }
    if (!best) {
      return `Jeg fant ingen sett å beregne PR for i ${exercise.name}.`;
    }
    const dt = new Date(best.createdAt);
    const dateLabel = dt.toLocaleDateString('nb-NO');
    const timeLabel = dt.toLocaleTimeString('nb-NO', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const oneRm = estimateOneRm(best.weight, best.reps);
    return (
      `Din beste loggede prestasjon i ${exercise.name} er ${best.weight} kg x ${best.reps} reps ` +
      `(${dateLabel}, ${timeLabel}).\n\nEstimert 1RM ut fra dette er ca. ${oneRm} kg.`
    );
  }

  // 2) "Hvor mange reps på X kg de siste N dagene?"
  if (q.includes('hvor mange rep')) {
    const weight = extractWeight(trimmed);
    if (weight == null) {
      // ingen spesifikk vekt – gi generell info
      const totalReps = exerciseSets.reduce((sum, s) => sum + s.reps, 0);
      return `Du har totalt logget ${totalReps} reps i ${exercise.name}. ` +
        'Spør meg f.eks: "Hvor mange reps på 100 kg i benkpress de siste 30 dagene?" for mer spesifikk info.';
    }

    const limit = parseTimeWindow(trimmed);
    const now = new Date();
    const filtered = exerciseSets.filter((s) => {
      if (Math.round(s.weight) !== Math.round(weight)) return false;
      if (!limit) return true;
      return new Date(s.createdAt) >= limit && new Date(s.createdAt) <= now;
    });

    if (filtered.length === 0) {
      if (limit) {
        return `Jeg fant ingen sett på ${weight} kg i ${exercise.name} i valgt tidsrom.`;
      }
      return `Jeg fant ingen sett på ${weight} kg i ${exercise.name} enda.`;
    }

    const totalReps = filtered.reduce((sum, s) => sum + s.reps, 0);
    const firstDate = new Date(filtered[filtered.length - 1].createdAt);
    const lastDate = new Date(filtered[0].createdAt);
    const firstLabel = firstDate.toLocaleDateString('nb-NO');
    const lastLabel = lastDate.toLocaleDateString('nb-NO');

    const periodText = limit
      ? `i perioden ${firstLabel}–${lastLabel}`
      : 'totalt i loggen din';

    return (
      `Du har totalt gjort ${totalReps} reps på ${weight} kg i ${exercise.name} ${periodText}.\n` +
      `(${filtered.length} loggede sett på den vekten.)`
    );
  }

  // 3) Siste sett i øvelsen (standardspørsmål: "Hva tok jeg sist i benkpress?")
  if (q.includes('hva tok jeg sist') || q.includes('sist i')) {
    const last = getLastSetForExercise(appState, exercise.id);
    if (!last) {
      return `Jeg fant ingen sett for ${exercise.name} enda.`;
    }
    const dt = new Date(last.createdAt);
    const dateLabel = dt.toLocaleDateString('nb-NO');
    const timeLabel = dt.toLocaleTimeString('nb-NO', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `Sist logget sett i ${exercise.name} var ${last.weight} kg x ${last.reps} reps (${dateLabel}, ${timeLabel}).`;
  }

  // 4) Generelt "hvordan ligger jeg an i X?"
  if (
    q.includes('hvordan ligger jeg an') ||
    q.includes('hvordan går det i') ||
    q.includes('hvordan er progresjonen') ||
    q.includes('utviklingen min')
  ) {
    const last = exerciseSets[0];
    const first = exerciseSets[exerciseSets.length - 1];
    const lastOneRm = estimateOneRm(last.weight, last.reps);
    const firstOneRm = estimateOneRm(first.weight, first.reps);
    const diff = Math.round((lastOneRm - firstOneRm) * 10) / 10;
    const trend =
      diff > 0
        ? `Du har økt estimert 1RM med ca. ${diff} kg siden du startet å logge.`
        : diff < 0
        ? `Estimert 1RM er ca. ${Math.abs(diff)} kg lavere enn da du startet å logge.`
        : 'Estimert 1RM er omtrent lik som da du startet å logge.';
    return (
      `I ${exercise.name} ligger du nå på omtrent ${lastOneRm} kg 1RM-basert på siste loggede sett (${last.weight} kg x ${last.reps} reps).\n\n` +
      trend
    );
  }

  // Fallback: gi siste sett + hint
  const last = getLastSetForExercise(appState, exercise.id);
  if (!last) {
    return `Jeg fant ingen sett for ${exercise.name} enda.`;
  }
  const dt = new Date(last.createdAt);
  const dateLabel = dt.toLocaleDateString('nb-NO');
  const timeLabel = dt.toLocaleTimeString('nb-NO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    `Jeg er ikke helt sikker på hva du mente, men her er siste loggede sett i ${exercise.name}:\n\n` +
    `${last.weight} kg x ${last.reps} reps (${dateLabel}, ${timeLabel}).\n\n` +
    'Prøv for eksempel: "Hva er PR-en min i ' +
    exercise.name +
    '?" eller "Hvor mange reps på 100 kg har jeg gjort de siste 30 dagene?".'
  );
}
