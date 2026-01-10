import { useCallback, useMemo, useReducer, useRef } from 'react';
import { PanResponder, Platform, useWindowDimensions } from 'react-native';
import { assertNever } from '../../shared/assert';
import {
  BACK_SWIPE_BACK_ZONE_RATIO,
  BACK_SWIPE_EDGE_DEFAULT_PX,
  BACK_SWIPE_EDGE_IOS_PX,
  BACK_SWIPE_HORIZONTAL_SLOPE_RATIO,
  BACK_SWIPE_MAX_VERTICAL_PX,
  BACK_SWIPE_MIN_START_DRAG_PX,
  BACK_SWIPE_MIN_VELOCITY,
  BACK_SWIPE_TRIGGER_DISTANCE_PX,
} from '../../shared/constants';
import type { BackSwipeBlockerRect, BackSwipeContextValue } from './BackSwipeContext';

export type Nav = { screen: string; [k: string]: any };

type NavHistoryState<TNav extends Nav> = {
  stack: TNav[];
  index: number;
};

type NavHistoryAction<TNav extends Nav> =
  | { type: 'reset'; nav: TNav }
  | { type: 'navigate'; nav: TNav }
  | { type: 'back' }
  | { type: 'forward' };

// IMPORTANT:
// Reducers must remain pure.
// Never mutate `state` or `action` objects.
function navHistoryReducer<TNav extends Nav>(
  state: NavHistoryState<TNav>,
  action: NavHistoryAction<TNav>
): NavHistoryState<TNav> {
  switch (action.type) {
    case 'reset': {
      return { stack: [action.nav], index: 0 };
    }
    case 'navigate': {
      const stack = state.stack.slice(0, state.index + 1);
      stack.push(action.nav);
      return { stack, index: stack.length - 1 };
    }
    case 'back': {
      if (state.index <= 0) return state;
      return { ...state, index: state.index - 1 };
    }
    case 'forward': {
      if (state.index >= state.stack.length - 1) return state;
      return { ...state, index: state.index + 1 };
    }
    default: {
      return assertNever(action);
    }
  }
}

// Navigation stack + swipe-back/forward gesture handling.
// This is intentionally behavior-preserving vs the original App.tsx implementation.
export function useNavStack<TNav extends Nav>(initial: TNav): {
  nav: TNav;
  canBack: boolean;
  canForward: boolean;
  navigate: (screen: TNav['screen'], params?: Record<string, any>) => void;
  back: () => void;
  forward: () => void;
  reset: (nav: TNav) => void;
  // Swipe-back integration (used by App.tsx on the root View).
  panHandlers: ReturnType<typeof PanResponder.create>['panHandlers'];
  backSwipeContextValue: BackSwipeContextValue;
} {
  const [navHistory, dispatchNav] = useReducer(navHistoryReducer<TNav>, {
    stack: [initial],
    index: 0,
  });

  const nav = navHistory.stack[navHistory.index] ?? initial;
  const canBack = navHistory.index > 0;
  const canForward = navHistory.index < navHistory.stack.length - 1;

  const navigate = useCallback(
    (screen: TNav['screen'], params?: Record<string, any>) => {
      // Preserve original App.tsx semantics: params are merged on top of `screen`.
      dispatchNav({ type: 'navigate', nav: { screen, ...(params ?? {}) } as TNav });
    },
    []
  );

  const back = useCallback(() => {
    dispatchNav({ type: 'back' });
  }, []);

  const forward = useCallback(() => {
    dispatchNav({ type: 'forward' });
  }, []);

  const reset = useCallback((nextNav: TNav) => {
    dispatchNav({ type: 'reset', nav: nextNav });
  }, []);

  // BackSwipeContext plumbing (blocker rects are registered by child components).
  const backSwipeBlockersRef = useRef<Record<string, BackSwipeBlockerRect>>({});
  const registerBackSwipeBlocker = useCallback((id: string, rect: BackSwipeBlockerRect) => {
    backSwipeBlockersRef.current[id] = rect;
  }, []);
  const unregisterBackSwipeBlocker = useCallback((id: string) => {
    delete backSwipeBlockersRef.current[id];
  }, []);

  const backSwipeContextValue = useMemo<BackSwipeContextValue>(
    () => ({
      registerBlocker: registerBackSwipeBlocker,
      unregisterBlocker: unregisterBackSwipeBlocker,
      blockersRef: backSwipeBlockersRef,
    }),
    [registerBackSwipeBlocker, unregisterBackSwipeBlocker]
  );

  const { width: windowWidth } = useWindowDimensions();

  const panResponder = useMemo(() => {
    const isIOS = Platform.OS === 'ios';
    const edgeWidth = isIOS ? BACK_SWIPE_EDGE_IOS_PX : BACK_SWIPE_EDGE_DEFAULT_PX;
    const backZoneStartX = windowWidth * BACK_SWIPE_BACK_ZONE_RATIO;

    const isInsideBlockedArea = (x: number, y: number) => {
      const blockers = backSwipeBlockersRef.current;
      for (const rect of Object.values(blockers)) {
        if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
          return true;
        }
      }
      return false;
    };

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) => {
        if (gesture.numberActiveTouches !== 1) return false;
        if (!canBack && !canForward) return false;

        if (isInsideBlockedArea(gesture.x0, gesture.y0)) return false;

        const fromBackZone = gesture.x0 < backZoneStartX;
        const fromRightEdge = gesture.x0 > windowWidth - edgeWidth;
        if (!fromBackZone && !fromRightEdge) return false;

        const dx = gesture.dx;
        const dy = gesture.dy;
        if (Math.abs(dy) > BACK_SWIPE_MAX_VERTICAL_PX) return false;
        const isHorizontal = Math.abs(dx) > Math.abs(dy) * BACK_SWIPE_HORIZONTAL_SLOPE_RATIO;
        if (!isHorizontal) return false;
        if (dx > BACK_SWIPE_MIN_START_DRAG_PX && fromBackZone && canBack) return true;
        if (dx < -BACK_SWIPE_MIN_START_DRAG_PX && fromRightEdge && canForward) return true;
        return false;
      },
      onPanResponderRelease: (_evt, gesture) => {
        const dx = gesture.dx;
        const dy = gesture.dy;
        if (Math.abs(dy) > BACK_SWIPE_MAX_VERTICAL_PX) return;
        const isHorizontal = Math.abs(dx) > Math.abs(dy) * BACK_SWIPE_HORIZONTAL_SLOPE_RATIO;
        if (!isHorizontal) return;

        const fromBackZone = gesture.x0 < backZoneStartX;
        const fromRightEdge = gesture.x0 > windowWidth - edgeWidth;

        if (
          fromBackZone &&
          dx > BACK_SWIPE_TRIGGER_DISTANCE_PX &&
          gesture.vx > BACK_SWIPE_MIN_VELOCITY &&
          canBack
        ) {
          back();
          return;
        }

        if (
          fromRightEdge &&
          dx < -BACK_SWIPE_TRIGGER_DISTANCE_PX &&
          gesture.vx < -BACK_SWIPE_MIN_VELOCITY &&
          canForward
        ) {
          forward();
        }
      },
    });
  }, [back, canBack, canForward, forward, windowWidth]);

  return {
    nav,
    canBack,
    canForward,
    navigate,
    back,
    forward,
    reset,
    panHandlers: panResponder.panHandlers,
    backSwipeContextValue,
  };
}
