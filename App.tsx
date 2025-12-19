import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { AppState } from './src/types';
import {
  loadAppState,
  saveAppState,
  createInitialState,
} from './src/storage/storage';
import {
  addExercise,
  addExerciseWithSets,
  addSet,
  addSetsForExercise,
  renameExercise,
  deleteExercise,
  updateSet,
  deleteSet,
} from './src/services/workoutService';

import { LandingScreen } from './src/screens/LandingScreen';
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

type ScreenName =
  | 'landing'
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

interface NavState {
  screen: ScreenName;
  selectedBlockId?: string | null;
  selectedExerciseId?: string | null;
  aiInitialQuestion?: string | null;
}

export default function App() {
  const [appState, setAppState] = useState<AppState | null>(null);
  const [nav, setNav] = useState<NavState>({ screen: 'landing' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const stored = await loadAppState();
      if (stored) {
        setAppState(stored);
      } else {
        setAppState({
          userEmail: null,
          blocks: [],
          exercises: [],
          sets: [],
        });
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (appState && !loading) {
      saveAppState(appState);
    }
  }, [appState, loading]);

  const navigate = (screen: ScreenName, params?: Partial<NavState>) => {
    setNav({ screen, ...params });
  };

  const handleLandingContinue = () => {
    if (appState && appState.userEmail) {
      navigate('home');
    } else {
      navigate('welcome');
    }
  };

  const handleWelcomeComplete = (email: string) => {
    const initial = createInitialState(email);
    setAppState(initial);
    setNav({ screen: 'home' });
  };

  if (loading || !appState) {
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
        <LandingScreen onContinue={handleLandingContinue} />
      )}

      {nav.screen === 'welcome' && (
        <WelcomeScreen onComplete={handleWelcomeComplete} />
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
          onLogExisting={(exerciseId, sets) => {
            setAppState((prev) =>
              prev ? addSetsForExercise(prev, exerciseId, sets) : prev
            );
          }}
          onLogNew={(blockId, name, sets) => {
            setAppState((prev) =>
              prev ? addExerciseWithSets(prev, blockId, name, sets) : prev
            );
          }}
        />
      )}

      {nav.screen === 'profile' && (
        <ProfileScreen
          appState={appState}
          onBack={() => navigate('home')}
          onUpdate={(next: AppState) => setAppState(next)}
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
