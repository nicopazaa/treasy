import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LandingScreen } from './src/screens/LandingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { BlockScreen } from './src/screens/BlockScreen';
import { ExerciseScreen } from './src/screens/ExerciseScreen';
import { AIScreen } from './src/screens/AIScreen';
import { CardioScreen } from './src/screens/CardioScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { RepMaxScreen } from './src/screens/RepMaxScreen';
import { AnalysisScreen } from './src/screens/AnalysisScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { QuickLogScreen } from './src/screens/QuickLogScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ManageExercisesScreen } from './src/screens/ManageExercisesScreen';

import { useAppActions } from './src/app/actions/useAppActions';
import { BackSwipeContext } from './src/app/navigation/BackSwipeContext';
import type { NavState } from './src/app/navigation/types';
import { useNavStack } from './src/app/navigation/useNavStack';
import { useAppStore } from './src/app/state/useAppStore';
import { useDerivedCache } from './src/app/state/useDerivedCache';
import { t } from './src/shared/i18n/i18n';

export default function App() {
  // Store (hydration + persistence wiring)
  const { appState, setAppState, loading, persister } = useAppStore();

  // In-memory indexes for fast lookups in the composition layer.
  const derivedCache = useDerivedCache(appState);

  // Navigation stack + swipe back/forward gesture handling.
  const { nav, navigate, reset, panHandlers, backSwipeContextValue } = useNavStack<NavState>({
    screen: 'landing',
  });

  // Actions / orchestration: mutations + persistence mode (saveNow vs debounced) + auth flow.
  const actions = useAppActions({
    appState,
    setAppState,
    loading,
    persister,
    derivedCache,
    navigate,
  });

  // Preserve original init behavior: after hydration, reset nav stack once based on onboarded status.
  const didInitNavRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (didInitNavRef.current) return;
    didInitNavRef.current = true;
    reset({ screen: appState.onboarded ? 'home' : 'landing' });
  }, [appState.onboarded, loading, reset]);

  if (loading || actions.authBusy) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <ExpoStatusBar style="light" />
        </View>
      </SafeAreaProvider>
    );
  }

  const currentBlock = nav.selectedBlockId ? appState.blocks.find((b) => b.id === nav.selectedBlockId) : null;

  const currentExercise = nav.selectedExerciseId
    ? derivedCache.exerciseById.get(nav.selectedExerciseId) ?? null
    : null;

  return (
    <SafeAreaProvider>
      <BackSwipeContext.Provider value={backSwipeContextValue}>
        <View style={styles.appContainer} {...panHandlers}>
          <StatusBar barStyle="light-content" />
          <ExpoStatusBar style="light" />

          {nav.screen === 'landing' && (
            <LandingScreen
              language={appState.language ?? 'en'}
              onContinueWithoutLogin={actions.handleContinueWithoutLogin}
              onLogin={() => navigate('login')}
            />
          )}

          {nav.screen === 'login' && (
            <LoginScreen
              language={appState.language ?? 'en'}
              onBack={() => navigate(appState.onboarded ? 'profile' : 'landing')}
              onContinueWithGithub={actions.startGithubLogin}
              onContinueWithEmail={() => {
                actions.clearLoginError();
                navigate('welcome');
              }}
              error={actions.loginError}
            />
          )}

          {nav.screen === 'welcome' && (
            <WelcomeScreen
              language={appState.language ?? 'en'}
              onBack={() => navigate('login')}
              onComplete={actions.handleWelcomeComplete}
            />
          )}

          {nav.screen === 'home' && (
            <HomeScreen
              appState={appState}
              onSelectBlock={(blockId) => navigate('block', { selectedBlockId: blockId })}
              onOpenAI={() => navigate('ai')}
              onOpenQuickLog={() => navigate('quickLog')}
              onOpenProfile={() => navigate('profile')}
              onOpenSettings={() => navigate('settings')}
              onOpenHistory={actions.openHistory}
              onOpenHistoryForDate={actions.openHistoryForDate}
              onOpenProgress={() => navigate('progress')}
              onOpenRepMax={() => navigate('repMax')}
              onOpenAnalysis={() => navigate('analysis')}
              onStartCardio={actions.handleStartCardio}
              onAddNote={actions.handleAddNote}
            />
          )}

          {nav.screen === 'block' && currentBlock && (
            <BlockScreen
              language={appState.language ?? 'en'}
              massUnit={appState.massUnit ?? 'kg'}
              block={currentBlock}
              exercises={derivedCache.exercisesByBlockId.get(currentBlock.id) ?? []}
              sets={appState.sets}
              allBlocks={appState.blocks}
              onBack={() => navigate('home')}
              onSelectExercise={(exerciseId) =>
                navigate('exercise', {
                  selectedBlockId: currentBlock.id,
                  selectedExerciseId: exerciseId,
                })
              }
              onReorderExercises={(orderedExerciseIds) => actions.reorderExercises(currentBlock.id, orderedExerciseIds)}
              onMoveExercise={actions.moveExercise}
              onAddExercise={(name, metadata) => actions.addExerciseToBlock(currentBlock.id, name, metadata)}
              onRenameExercise={actions.renameExerciseById}
              onDeleteExercise={actions.deleteExerciseById}
              onRestoreExercise={actions.restoreExerciseEntry}
            />
          )}

          {nav.screen === 'exercise' && currentExercise && (
            <ExerciseScreen
              language={appState.language ?? 'en'}
              massUnit={appState.massUnit ?? 'kg'}
              exercise={currentExercise}
              sets={derivedCache.setsByExerciseId.get(currentExercise.id) ?? []}
              onBack={() =>
                navigate('block', {
                  selectedBlockId: currentExercise.blockId,
                  selectedExerciseId: currentExercise.id,
                })
              }
              onAddSet={(weight, reps, meta) => actions.addSetToExercise(currentExercise.id, weight, reps, meta)}
              onUpdateSet={(setId, weight, reps, meta) => actions.updateSetById(setId, weight, reps, meta)}
              onDeleteSet={actions.deleteSetById}
              onRestoreSet={actions.restoreSetEntry}
              onAskAIForExercise={() =>
                navigate('ai', {
                  selectedExerciseId: currentExercise.id,
                  aiInitialQuestion: t(appState.language ?? 'en', 'appa.prompt.lastForExercise', {
                    exercise: currentExercise.name,
                  }),
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

          {nav.screen === 'cardio' && (
            <CardioScreen
              language={appState.language ?? 'en'}
              cardioEntries={appState.cardioEntries}
              exerciseId={nav.selectedExerciseId ?? null}
              onBack={() => navigate('home')}
              onSave={(data) => {
                actions.saveCardio(data);
                navigate('home');
              }}
            />
          )}

          {nav.screen === 'history' && (
            <HistoryScreen
              appState={appState}
              onBack={() => navigate('home')}
              initialExpandedDateKey={actions.historyInitialDateKey}
            />
          )}

          {nav.screen === 'progress' && <ProgressScreen appState={appState} onBack={() => navigate('home')} />}

          {nav.screen === 'analysis' && (
            <AnalysisScreen language={appState.language ?? 'en'} onBack={() => navigate('home')} />
          )}

          {nav.screen === 'repMax' && <RepMaxScreen appState={appState} onBack={() => navigate('home')} />}

          {nav.screen === 'quickLog' && (
            <QuickLogScreen
              appState={appState}
              onBack={() => navigate('home')}
              onSave={actions.handleQuickLogSave}
              onLogSet={actions.handleQuickLogSet}
              onCategorizeExercise={actions.categorizeExercise}
              showLocalOnlyNotice={nav.showLocalOnlyNotice ?? false}
            />
          )}

          {nav.screen === 'profile' && (
            <ProfileScreen
              appState={appState}
              onBack={() => navigate('home')}
              onUpdate={actions.updateProfile}
              onOpenLogin={() => navigate('login')}
            />
          )}

          {nav.screen === 'settings' && (
            <SettingsScreen
              appState={appState}
              onBack={() => navigate('home')}
              onUpdate={actions.updateSettings}
              onOpenManageExercises={() => navigate('manageExercises')}
            />
          )}

          {nav.screen === 'manageExercises' && (
            <ManageExercisesScreen
              appState={appState}
              onBack={() => navigate('settings')}
              onMerge={actions.mergeExercisesById}
            />
          )}
        </View>
      </BackSwipeContext.Provider>
    </SafeAreaProvider>
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
