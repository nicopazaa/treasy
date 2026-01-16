import { useCallback, useMemo, useState } from 'react';
import { toKg, type MassUnit } from '../utils/units';

export type SetLoggerField = 'weight' | 'reps';

export type ParsedSetLoggerInput = {
  weightKg?: number;
  reps?: number;
};

export type CardioLoggerField = 'duration' | 'distance' | 'pause';

export type ParsedCardioLoggerInput = {
  distanceKm: number | null;
  durationMin: number | null;
  pauseSec: number | null;
};

function normalizeDecimalInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const normalized = trimmed.replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const firstDot = normalized.indexOf('.');
  if (firstDot === -1) return normalized;

  const head = normalized.slice(0, firstDot);
  const tail = normalized.slice(firstDot + 1).replace(/\./g, '');
  return `${head}.${tail}`;
}

function parseOptionalNonNegativeFloat(raw: string): number | null {
  const normalized = normalizeDecimalInput(raw);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function parseOptionalPositiveNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function parseOptionalPositiveFloat(raw: string): number | null {
  const normalized = normalizeDecimalInput(raw);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function appendWeightKey(prev: string, key: string): string {
  const next = prev ?? '';
  const isDigit = /^[0-9]$/.test(key);
  const isDecimal = key === '.' || key === ',';
  if (!isDigit && !isDecimal) return next;

  if (isDecimal) {
    if (next.includes('.') || next.includes(',')) return next;
    if (!next) return `0${key}`;
    return `${next}${key}`;
  }

  return `${next}${key}`;
}

function appendRepsKey(prev: string, key: string): string {
  const next = prev ?? '';
  const isDigit = /^[0-9]$/.test(key);
  if (!isDigit) return next;
  if (next === '0') return key;
  return `${next}${key}`;
}

export function useSetLoggerInput(opts: {
  massUnit: MassUnit;
  initialActiveField?: SetLoggerField;
}): {
  activeField: SetLoggerField;
  weightText: string;
  repsText: string;
  parsed: ParsedSetLoggerInput;
  setActiveField: (field: SetLoggerField) => void;
  setWeightText: (next: string) => void;
  setRepsText: (next: string) => void;
  appendKey: (key: string) => void;
  backspace: () => void;
  clear: () => void;
  clearAll: () => void;
} {
  const { massUnit, initialActiveField = 'weight' } = opts;
  const [activeField, setActiveField] = useState<SetLoggerField>(initialActiveField);
  const [weightText, setWeightText] = useState('');
  const [repsText, setRepsText] = useState('0');

  const appendKey = useCallback(
    (key: string) => {
      if (activeField === 'weight') {
        setWeightText((prev) => appendWeightKey(prev, key));
        return;
      }
      setRepsText((prev) => appendRepsKey(prev, key));
    },
    [activeField]
  );

  const backspace = useCallback(() => {
    if (activeField === 'weight') {
      setWeightText((prev) => (prev ? prev.slice(0, -1) : ''));
      return;
    }
    setRepsText((prev) => (prev && prev.length > 1 ? prev.slice(0, -1) : '0'));
  }, [activeField]);

  const clear = useCallback(() => {
    if (activeField === 'weight') {
      setWeightText('');
      return;
    }
    setRepsText('0');
  }, [activeField]);

  const clearAll = useCallback(() => {
    setWeightText('');
    setRepsText('0');
    setActiveField('weight');
  }, []);

  const parsed = useMemo<ParsedSetLoggerInput>(() => {
    const out: ParsedSetLoggerInput = {};

    const weightInput = parseOptionalNonNegativeFloat(weightText);
    if (weightInput != null) {
      const weightKg = toKg(weightInput, massUnit);
      if (Number.isFinite(weightKg) && weightKg >= 0) out.weightKg = weightKg;
    }

    const reps = parseOptionalPositiveNumber(repsText);
    if (reps != null) out.reps = reps;

    return out;
  }, [massUnit, repsText, weightText]);

  return {
    activeField,
    weightText,
    repsText,
    parsed,
    setActiveField,
    setWeightText,
    setRepsText,
    appendKey,
    backspace,
    clear,
    clearAll,
  };
}

export function useCardioLoggerInput(opts?: {
  initialActiveField?: CardioLoggerField;
}): {
  activeField: CardioLoggerField;
  distanceText: string;
  durationText: string;
  pauseText: string;
  parsed: ParsedCardioLoggerInput;
  setActiveField: (field: CardioLoggerField) => void;
  setDistanceText: (next: string) => void;
  setDurationText: (next: string) => void;
  setPauseText: (next: string) => void;
  appendKey: (key: string) => void;
  backspace: () => void;
  clear: () => void;
  clearAll: () => void;
} {
  const { initialActiveField = 'duration' } = opts ?? {};
  const [activeField, setActiveField] = useState<CardioLoggerField>(initialActiveField);
  const [distanceText, setDistanceText] = useState('');
  const [durationText, setDurationText] = useState('');
  const [pauseText, setPauseText] = useState('');

  const appendKey = useCallback(
    (key: string) => {
      if (activeField === 'distance') {
        setDistanceText((prev) => appendWeightKey(prev, key));
        return;
      }
      if (activeField === 'duration') {
        setDurationText((prev) => appendWeightKey(prev, key));
        return;
      }
      setPauseText((prev) => appendWeightKey(prev, key));
    },
    [activeField]
  );

  const backspace = useCallback(() => {
    if (activeField === 'distance') {
      setDistanceText((prev) => (prev ? prev.slice(0, -1) : ''));
      return;
    }
    if (activeField === 'duration') {
      setDurationText((prev) => (prev ? prev.slice(0, -1) : ''));
      return;
    }
    setPauseText((prev) => (prev ? prev.slice(0, -1) : ''));
  }, [activeField]);

  const clear = useCallback(() => {
    if (activeField === 'distance') {
      setDistanceText('');
      return;
    }
    if (activeField === 'duration') {
      setDurationText('');
      return;
    }
    setPauseText('');
  }, [activeField]);

  const clearAll = useCallback(() => {
    setDistanceText('');
    setDurationText('');
    setPauseText('');
    setActiveField('duration');
  }, []);

  const parsed = useMemo<ParsedCardioLoggerInput>(() => {
    return {
      distanceKm: parseOptionalPositiveFloat(distanceText),
      durationMin: parseOptionalPositiveFloat(durationText),
      pauseSec: parseOptionalPositiveFloat(pauseText),
    };
  }, [distanceText, durationText, pauseText]);

  return {
    activeField,
    distanceText,
    durationText,
    pauseText,
    parsed,
    setActiveField,
    setDistanceText,
    setDurationText,
    setPauseText,
    appendKey,
    backspace,
    clear,
    clearAll,
  };
}
