import React, { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar, Platform } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { AppState, loadAppState, saveAppState, createInitialState } from './src/features/workouts';
import {
  addExercise,
  addExerciseWithSets,
  addExerciseWithSetsResult,
  addLogEntry,
  addSet,
  addSetsForExercise,
  reorderExercisesInBlock,
  renameExercise,
  deleteExercise,
  setExerciseBlockId,
  updateSet,
  deleteSet,
} from './src/features/workouts';

import { LandingScreen } from './src/screens/LandingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { BlockScreen } from './src/screens/BlockScreen';
import { ExerciseScreen } from './src/screens/ExerciseScreen';
import { AIScreen } from './src/screens/AIScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { RepMaxScreen } from './src/screens/RepMaxScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { QuickLogScreen } from './src/screens/QuickLogScreen';
import { parseQuickLog, findExerciseFuzzy } from './src/features/quicklog';
import { t } from './src/shared/i18n/i18n';
import type { NavState, ScreenName } from './src/app/navigation/types';

export default function App() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [nav, setNav] = useState<NavState>({ screen: 'landing' });
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const githubHandledRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      const stored = await loadAppState();
      const next = stored ?? createInitialState();
      setAppState(next);
      setNav({ screen: next.onboarded ? 'home' : 'landing' });
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (loading || !appState) return;
    if (githubHandledRef.current) return;
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (url.pathname !== '/auth/github') return;

    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    if (!code) return;

    githubHandledRef.current = true;
    setAuthBusy(true);

    const storedState = window.sessionStorage?.getItem('treasy_github_oauth_state') ?? null;
    if (!returnedState || !storedState || returnedState !== storedState) {
      setLoginError(t(appState.language ?? 'en', 'githubFailed'));
      window.history.replaceState({}, '', '/');
      setAuthBusy(false);
      setNav({ screen: 'login' });
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/.netlify/functions/github-oauth?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? 'GitHub OAuth failed');
        }

        setAppState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            onboarded: true,
            authProvider: 'github',
            userEmail: data?.email ?? prev.userEmail,
            nickname: prev.nickname ?? data?.login ?? prev.nickname,
          };
        });

        setLoginError(null);
        setNav({ screen: 'quickLog' });
      } catch (e) {
        console.warn('GitHub auth failed', e);
        setLoginError(t(appState.language ?? 'en', 'githubFailed'));
        setNav({ screen: 'login' });
      } finally {
        window.sessionStorage?.removeItem('treasy_github_oauth_state');
        window.history.replaceState({}, '', '/');
        setAuthBusy(false);
      }
    })();
  }, [appState, loading]);

  useEffect(() => {
    if (appState && !loading) {
      saveAppState(appState);
    }
  }, [appState, loading]);

  const navigate = (screen: ScreenName, params?: Partial<NavState>) => {
    setNav({ screen, ...params });
  };

  const handleContinueWithoutLogin = () => {
    setLoginError(null);
    setAppState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        onboarded: true,
        authProvider: prev.authProvider ?? 'guest',
      };
    });
    navigate('quickLog', { showLocalOnlyNotice: true });
  };

  const handleWelcomeComplete = (email: string) => {
    const trimmed = email.trim().toLowerCase();
    setLoginError(null);
    setAppState((prev) => {
      const current = prev ?? createInitialState();
      const derivedNickname =
        current.nickname && current.nickname.trim()
          ? current.nickname
          : trimmed.includes('@')
            ? trimmed.split('@')[0]
            : null;
      return {
        ...current,
        onboarded: true,
        authProvider: 'email',
        userEmail: trimmed,
        nickname: derivedNickname,
      };
    });
    setNav({ screen: 'quickLog' });
  };

  const startGithubLogin = () => {
    setLoginError(null);

    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setLoginError(t(appState?.language ?? 'en', 'githubWebOnly'));
      return;
    }

    const clientId = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId) {
      setLoginError(t(appState?.language ?? 'en', 'githubNotConfigured'));
      return;
    }

    const state = `st_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    window.sessionStorage?.setItem('treasy_github_oauth_state', state);

    const redirectUri = `${window.location.origin}/auth/github`;
    const params = new URLSearchParams();
    params.set('client_id', clientId);
    params.set('redirect_uri', redirectUri);
    params.set('scope', 'read:user user:email');
    params.set('state', state);

    window.location.assign(`https://github.com/login/oauth/authorize?${params.toString()}`);
  };

  const handleQuickLogSave = (
    text: string
  ): { newExerciseId?: string; newExerciseName?: string } => {
    if (!appState) return {};

    let next = addLogEntry(appState, text);
    const parsed = parseQuickLog(text);

    if (parsed) {
      const existing = findExerciseFuzzy(next, parsed.exerciseName);
      if (existing) {
        next = addSetsForExercise(next, existing.id, parsed.sets);
      } else {
        const created = addExerciseWithSetsResult(
          next,
          'uncategorized',
          parsed.exerciseName,
          parsed.sets
        );
        if (created) {
          next = created.nextState;
          setAppState(next);
          return { newExerciseId: created.exerciseId, newExerciseName: parsed.exerciseName };
        }
      }
    }

    setAppState(next);
    return {};
  };

  const handleQuickLogSet = (exerciseId: string, weight: number, reps: number) => {
    setAppState((prev) => {
      if (!prev) return prev;

      const exercise = prev.exercises.find((ex) => ex.id === exerciseId);
      const language = prev.language ?? 'en';
      const weightText = language === 'nb' ? String(weight).replace('.', ',') : String(weight);
      const logText = exercise ? `${exercise.name} ${weightText}x${reps}` : `${weightText}x${reps}`;

      let next = addSet(prev, exerciseId, weight, reps);
      next = addLogEntry(next, logText);
      return next;
    });
  };

  if (loading || !appState || authBusy) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <ExpoStatusBar style="light" />
      </View>
    );
  }

  const currentBlock = nav.selectedBlockId
    ? appState.blocks.find((b) => b.id === nav.selectedBlockId)
    : null;

  const currentExercise = nav.selectedExerciseId
    ? appState.exercises.find((e) => e.id === nav.selectedExerciseId)
    : null;

  return (
    <View style={styles.appContainer}>
      <StatusBar barStyle="light-content" />
      <ExpoStatusBar style="light" />

      {nav.screen === 'landing' && (
        <LandingScreen
          language={appState.language ?? 'en'}
          onContinueWithoutLogin={handleContinueWithoutLogin}
          onLogin={() => navigate('login')}
        />
      )}

      {nav.screen === 'login' && (
        <LoginScreen
          language={appState.language ?? 'en'}
          onBack={() => navigate(appState.onboarded ? 'profile' : 'landing')}
          onContinueWithGithub={() => {
            startGithubLogin();
          }}
          onContinueWithEmail={() => {
            setLoginError(null);
            navigate('welcome');
          }}
          error={loginError}
        />
      )}

      {nav.screen === 'welcome' && (
        <WelcomeScreen
          language={appState.language ?? 'en'}
          onBack={() => navigate('login')}
          onComplete={handleWelcomeComplete}
        />
      )}

      {nav.screen === 'home' && (
        <HomeScreen
          appState={appState}
          onSelectBlock={(blockId) =>
            navigate('block', { selectedBlockId: blockId })
          }
          onOpenAI={() => navigate('ai')}
          onOpenQuickLog={() => navigate('quickLog')}
          onOpenProfile={() => navigate('profile')}
          onOpenHistory={() => navigate('history')}
          onOpenProgress={() => navigate('progress')}
          onOpenRepMax={() => navigate('repMax')}
        />
      )}

      {nav.screen === 'block' && currentBlock && (
        <BlockScreen
          language={appState.language ?? 'en'}
          block={currentBlock}
          exercises={appState.exercises.filter(
            (ex) => ex.blockId === currentBlock.id
          )}
          onBack={() => navigate('home')}
          onSelectExercise={(exerciseId) =>
            navigate('exercise', {
              selectedBlockId: currentBlock.id,
              selectedExerciseId: exerciseId,
            })
          }
          onReorderExercises={(orderedExerciseIds) => {
            setAppState((prev) =>
              prev ? reorderExercisesInBlock(prev, currentBlock.id, orderedExerciseIds) : prev
            );
          }}
          onAddExercise={(name) => {
            setAppState((prev) =>
              prev ? addExercise(prev, currentBlock.id, name) : prev
            );
          }}
          onRenameExercise={(exerciseId, name) => {
            setAppState((prev) =>
              prev ? renameExercise(prev, exerciseId, name) : prev
            );
          }}
          onDeleteExercise={(exerciseId) => {
            setAppState((prev) =>
              prev ? deleteExercise(prev, exerciseId) : prev
            );
          }}
        />
      )}

      {nav.screen === 'exercise' && currentExercise && (
        <ExerciseScreen
          language={appState.language ?? 'en'}
          exercise={currentExercise}
          sets={appState.sets
            .filter((s) => s.exerciseId === currentExercise.id)
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))}
          onBack={() =>
            navigate('block', {
              selectedBlockId: currentExercise.blockId,
              selectedExerciseId: currentExercise.id,
            })
          }
          onAddSet={(weight, reps) => {
            setAppState((prev) =>
              prev ? addSet(prev, currentExercise.id, weight, reps) : prev
            );
          }}
          onUpdateSet={(setId, weight, reps) => {
            setAppState((prev) =>
              prev ? updateSet(prev, setId, weight, reps) : prev
            );
          }}
          onDeleteSet={(setId) => {
            setAppState((prev) => (prev ? deleteSet(prev, setId) : prev));
          }}
          onAskAIForExercise={() =>
            navigate('ai', {
              selectedExerciseId: currentExercise.id,
              aiInitialQuestion: `Hva tok jeg sist i ${currentExercise.name}?`,
            })
          }
        />
      )}

      {nav.screen === 'ai' && (
        <AIScreen
          appState={appState}
          onBack={() => navigate('home')}
          initialQuestion={nav.aiInitialQuestion ?? undefined}
          initialExerciseId={nav.selectedExerciseId ?? null}
        />
      )}

      {nav.screen === 'history' && (
        <HistoryScreen appState={appState} onBack={() => navigate('home')} />
      )}

      {nav.screen === 'progress' && (
        <ProgressScreen appState={appState} onBack={() => navigate('home')} />
      )}

      {nav.screen === 'repMax' && (
        <RepMaxScreen appState={appState} onBack={() => navigate('home')} />
      )}

      {nav.screen === 'quickLog' && (
        <QuickLogScreen
          appState={appState}
          onBack={() => navigate('home')}
          onSave={handleQuickLogSave}
          onLogSet={handleQuickLogSet}
          onCategorizeExercise={(exerciseId, blockId) => {
            setAppState((prev) =>
              prev ? setExerciseBlockId(prev, exerciseId, blockId) : prev
            );
          }}
          showLocalOnlyNotice={nav.showLocalOnlyNotice ?? false}
        />
      )}

      {nav.screen === 'profile' && (
        <ProfileScreen
          appState={appState}
          onBack={() => navigate('home')}
          onUpdate={(next: AppState) => setAppState(next)}
          onOpenLogin={() => navigate('login')}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#020617',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
