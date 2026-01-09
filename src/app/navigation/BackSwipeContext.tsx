import React, { createContext, useContext } from 'react';

export type BackSwipeBlockerRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BackSwipeContextValue = {
  registerBlocker: (id: string, rect: BackSwipeBlockerRect) => void;
  unregisterBlocker: (id: string) => void;
  blockersRef: React.MutableRefObject<Record<string, BackSwipeBlockerRect>>;
};

export const BackSwipeContext = createContext<BackSwipeContextValue | null>(null);

export function useBackSwipeContext(): BackSwipeContextValue | null {
  return useContext(BackSwipeContext);
}
