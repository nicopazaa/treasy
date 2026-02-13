import React from 'react';
import { Platform, StyleSheet, Text, TextInput, type TextStyle } from 'react-native';

type TypographyWeight = 400 | 600 | 700;

const WEB_FALLBACKS = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial";

const INTER_BY_WEIGHT: Record<TypographyWeight, string> = {
  400: 'Inter-Regular',
  600: 'Inter-SemiBold',
  700: 'Inter-Bold',
};

export const STAT_NUMBER_STYLE: TextStyle = {
  fontVariant: ['tabular-nums'],
};

function normalizeWeight(weight: TextStyle['fontWeight']): TypographyWeight {
  if (!weight) return 400;
  if (weight === 'normal') return 400;
  if (weight === 'bold') return 700;

  const numeric = typeof weight === 'number' ? weight : Number(weight);
  if (!Number.isFinite(numeric)) return 400;

  // Clamp to the requested weights while keeping existing hierarchy reasonably intact:
  // - 400: body/default
  // - 600: section titles / headers (incl. very heavy legacy weights like 800/900)
  // - 700: strong emphasis (only when explicitly used)
  if (numeric >= 800) return 600;
  if (numeric >= 700) return 700;
  if (numeric >= 550) return 600;
  return 400;
}

function typographyOverrideForStyle(style: unknown): TextStyle {
  const flat = StyleSheet.flatten(style as any) as TextStyle | undefined;
  const normalized = normalizeWeight(flat?.fontWeight);
  const family = INTER_BY_WEIGHT[normalized];

  if (Platform.OS === 'web') {
    return { fontFamily: `${family}, ${WEB_FALLBACKS}`, fontWeight: 'normal' };
  }

  return { fontFamily: family, fontWeight: 'normal' };
}

function normalizeFontFamily(fontFamily: TextStyle['fontFamily']): TextStyle['fontFamily'] {
  if (Array.isArray(fontFamily)) return fontFamily.filter(Boolean).join(', ');
  return fontFamily;
}

function mergeTypographyStyle(style: unknown): TextStyle {
  const override = typographyOverrideForStyle(style);
  const merged = StyleSheet.flatten([style as any, override]) as TextStyle;
  const normalizedFontFamily = normalizeFontFamily(merged?.fontFamily);
  return normalizedFontFamily ? { ...merged, fontFamily: normalizedFontFamily } : merged;
}

let installed = false;

export function installGlobalTypography(): void {
  if (installed) return;
  installed = true;

  const TextAny = Text as any;
  if (typeof TextAny.render === 'function') {
    const baseRender = TextAny.render;
    TextAny.render = function render(...args: any[]) {
      const element = baseRender.call(this, ...args);
      if (!element?.props) return element;
      const mergedStyle = mergeTypographyStyle(element.props.style);
      return React.cloneElement(element, { style: mergedStyle });
    };
  } else {
    const prev = TextAny.defaultProps ?? {};
    TextAny.defaultProps = {
      ...prev,
      style: mergeTypographyStyle(prev.style),
    };
  }

  const TextInputAny = TextInput as any;
  if (typeof TextInputAny.render === 'function') {
    const baseRender = TextInputAny.render;
    TextInputAny.render = function render(...args: any[]) {
      const element = baseRender.call(this, ...args);
      if (!element?.props) return element;
      const mergedStyle = mergeTypographyStyle(element.props.style);
      return React.cloneElement(element, { style: mergedStyle });
    };
  } else {
    const prev = TextInputAny.defaultProps ?? {};
    TextInputAny.defaultProps = {
      ...prev,
      style: mergeTypographyStyle(prev.style),
    };
  }
}
