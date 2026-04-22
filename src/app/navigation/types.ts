export type ScreenName =
  | 'landing'
  | 'login'
  | 'welcome'
  | 'home'
  | 'block'
  | 'ai'
  | 'history'
  | 'progress'
  | 'repMax'
  | 'settings'
  | 'manageExercises'
  | 'quickLog'
  | 'cardio'
  | 'analysis'
  | 'notert'
  | 'privacy'
  | 'terms';

export interface NavState {
  screen: ScreenName;
  selectedBlockId?: string | null;
  selectedExerciseId?: string | null;
  aiInitialQuestion?: string | null;
  showLocalOnlyNotice?: boolean;
}
