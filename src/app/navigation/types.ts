export type ScreenName =
  | 'landing'
  | 'login'
  | 'welcome'
  | 'home'
  | 'block'
  | 'exercise'
  | 'ai'
  | 'history'
  | 'progress'
  | 'repMax'
  | 'profile'
  | 'quickLog';

export interface NavState {
  screen: ScreenName;
  selectedBlockId?: string | null;
  selectedExerciseId?: string | null;
  aiInitialQuestion?: string | null;
  showLocalOnlyNotice?: boolean;
}

