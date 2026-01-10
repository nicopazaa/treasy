import React, { useCallback, useEffect, useRef } from 'react';
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

import { ErrorBoundary } from './src/app/ErrorBoundary';
import { useAppActions } from './src/app/actions/useAppActions';
import { BackSwipeContext } from './src/app/navigation/BackSwipeContext';
import type { NavState } from './src/app/navigation/types';
import { useNavStack } from './src/app/navigation/useNavStack';
import { useAppStore } from './src/app/state/useAppStore';
import { useDerivedCache } from './src/app/state/useDerivedCache';
import { assertNever } from './src/shared/assert';
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

  const {
    authBusy,
    loginError,
    historyInitialDateKey,
    clearLoginError,
    openHistory,
    openHistoryForDate,
    handleContinueWithoutLogin,
    handleWelcomeComplete,
    startGithubLogin,
    handleStartCardio,
    handleAddNote,
    handleQuickLogSave,
    handleQuickLogSet,
    updateProfile,
    updateSettings,
    reorderExercises,
    moveExercise,
    addExerciseToBlock,
    renameExerciseById,
    deleteExerciseById,
    restoreExerciseEntry,
    addSetToExercise,
    updateSetById,
    deleteSetById,
    restoreSetEntry,
    categorizeExercise,
    saveCardio,
    mergeExercisesById,
  } = actions;

  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';

  const currentBlock = nav.selectedBlockId ? appState.blocks.find((b) => b.id === nav.selectedBlockId) : null;
  const currentBlockId = currentBlock?.id ?? null;

  const currentExercise = nav.selectedExerciseId
    ? derivedCache.exerciseById.get(nav.selectedExerciseId) ?? null
    : null;
  const currentExerciseId = currentExercise?.id ?? null;
  const currentExerciseBlockId = currentExercise?.blockId ?? null;
  const currentExerciseName = currentExercise?.name ?? null;

  const goHome = useCallback(() => navigate('home'), [navigate]);
  const goToLogin = useCallback(() => navigate('login'), [navigate]);
  const goToSettings = useCallback(() => navigate('settings'), [navigate]);
  const goToManageExercises = useCallback(() => navigate('manageExercises'), [navigate]);

  const handleLandingLogin = goToLogin;

  const handleLoginBack = useCallback(() => {
    navigate(appState.onboarded ? 'profile' : 'landing');
  }, [appState.onboarded, navigate]);

  const handleLoginContinueWithEmail = useCallback(() => {
    clearLoginError();
    navigate('welcome');
  }, [clearLoginError, navigate]);

  const handleWelcomeBack = goToLogin;

  const handleHomeSelectBlock = useCallback(
    (blockId: string) => {
      navigate('block', { selectedBlockId: blockId });
    },
    [navigate]
  );
  const handleHomeOpenAI = useCallback(() => navigate('ai'), [navigate]);
  const handleHomeOpenQuickLog = useCallback(() => navigate('quickLog'), [navigate]);
  const handleHomeOpenProfile = useCallback(() => navigate('profile'), [navigate]);
  const handleHomeOpenSettings = useCallback(() => navigate('settings'), [navigate]);
  const handleHomeOpenProgress = useCallback(() => navigate('progress'), [navigate]);
  const handleHomeOpenRepMax = useCallback(() => navigate('repMax'), [navigate]);
  const handleHomeOpenAnalysis = useCallback(() => navigate('analysis'), [navigate]);

  const handleBlockSelectExercise = useCallback(
    (exerciseId: string) => {
      if (!currentBlockId) return;
      navigate('exercise', { selectedBlockId: currentBlockId, selectedExerciseId: exerciseId });
    },
    [currentBlockId, navigate]
  );

  const handleBlockReorderExercises = useCallback(
    (orderedExerciseIds: string[]) => {
      if (!currentBlockId) return;
      reorderExercises(currentBlockId, orderedExerciseIds);
    },
    [currentBlockId, reorderExercises]
  );

  const handleBlockAddExercise = useCallback(
    (name: string, metadata?: Parameters<typeof addExerciseToBlock>[2]) => {
      if (!currentBlockId) return;
      addExerciseToBlock(currentBlockId, name, metadata);
    },
    [addExerciseToBlock, currentBlockId]
  );

  const handleExerciseBack = useCallback(() => {
    if (!currentExerciseId || !currentExerciseBlockId) return;
    navigate('block', { selectedBlockId: currentExerciseBlockId, selectedExerciseId: currentExerciseId });
  }, [currentExerciseBlockId, currentExerciseId, navigate]);

  const handleExerciseAddSet = useCallback(
    (weight: number, reps: number, meta?: Parameters<typeof addSetToExercise>[3]) => {
      if (!currentExerciseId) return;
      addSetToExercise(currentExerciseId, weight, reps, meta);
    },
    [addSetToExercise, currentExerciseId]
  );

  const handleExerciseUpdateSet = useCallback(
    (setId: string, weight: number, reps: number, meta?: Parameters<typeof updateSetById>[3]) => {
      updateSetById(setId, weight, reps, meta);
    },
    [updateSetById]
  );

  const handleExerciseAskAI = useCallback(() => {
    if (!currentExerciseId || !currentExerciseName) return;
    navigate('ai', {
      selectedExerciseId: currentExerciseId,
      aiInitialQuestion: t(language, 'appa.prompt.lastForExercise', { exercise: currentExerciseName }),
    });
  }, [currentExerciseId, currentExerciseName, language, navigate]);

  const handleCardioSave = useCallback(
    (data: Parameters<typeof saveCardio>[0]) => {
      saveCardio(data);
      goHome();
    },
    [goHome, saveCardio]
  );

  // Preserve original init behavior: after hydration, reset nav stack once based on onboarded status.
  const didInitNavRef = useRef(false);
  useEffect(() => {
    if (loading) return;
    if (didInitNavRef.current) return;
    didInitNavRef.current = true;
    reset({ screen: appState.onboarded ? 'home' : 'landing' });
  }, [appState.onboarded, loading, reset]);

  if (loading || authBusy) {
    return (
      <SafeAreaProvider>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <ExpoStatusBar style="light" />
        </View>
      </SafeAreaProvider>
    );
  }

  const screen = (() => {
    switch (nav.screen) {
      case 'landing':
        return (
          <LandingScreen
            language={language}
            onContinueWithoutLogin={handleContinueWithoutLogin}
            onLogin={handleLandingLogin}
          />
        );
      case 'login':
        return (
          <LoginScreen
            language={language}
            onBack={handleLoginBack}
            onContinueWithGithub={startGithubLogin}
            onContinueWithEmail={handleLoginContinueWithEmail}
            error={loginError}
          />
        );
      case 'welcome':
        return <WelcomeScreen language={language} onBack={handleWelcomeBack} onComplete={handleWelcomeComplete} />;
      case 'home':
        return (
          <HomeScreen
            appState={appState}
            onSelectBlock={handleHomeSelectBlock}
            onOpenAI={handleHomeOpenAI}
            onOpenQuickLog={handleHomeOpenQuickLog}
            onOpenProfile={handleHomeOpenProfile}
            onOpenSettings={handleHomeOpenSettings}
            onOpenHistory={openHistory}
            onOpenHistoryForDate={openHistoryForDate}
            onOpenProgress={handleHomeOpenProgress}
            onOpenRepMax={handleHomeOpenRepMax}
            onOpenAnalysis={handleHomeOpenAnalysis}
            onStartCardio={handleStartCardio}
            onAddNote={handleAddNote}
          />
        );
      case 'block':
        if (!currentBlock) return null;
        return (
          <BlockScreen
            language={language}
            massUnit={massUnit}
            block={currentBlock}
            exercises={derivedCache.exercisesByBlockId.get(currentBlock.id) ?? []}
            sets={appState.sets}
            allBlocks={appState.blocks}
            onBack={goHome}
            onSelectExercise={handleBlockSelectExercise}
            onReorderExercises={handleBlockReorderExercises}
            onMoveExercise={moveExercise}
            onAddExercise={handleBlockAddExercise}
            onRenameExercise={renameExerciseById}
            onDeleteExercise={deleteExerciseById}
            onRestoreExercise={restoreExerciseEntry}
          />
        );
      case 'exercise':
        if (!currentExercise) return null;
        return (
          <ExerciseScreen
            language={language}
            massUnit={massUnit}
            exercise={currentExercise}
            sets={derivedCache.setsByExerciseId.get(currentExercise.id) ?? []}
            onBack={handleExerciseBack}
            onAddSet={handleExerciseAddSet}
            onUpdateSet={handleExerciseUpdateSet}
            onDeleteSet={deleteSetById}
            onRestoreSet={restoreSetEntry}
            onAskAIForExercise={handleExerciseAskAI}
          />
        );
      case 'ai':
        return (
          <AIScreen
            appState={appState}
            onBack={goHome}
            initialQuestion={nav.aiInitialQuestion ?? undefined}
            initialExerciseId={nav.selectedExerciseId ?? null}
          />
        );
      case 'cardio':
        return (
          <CardioScreen
            language={language}
            cardioEntries={appState.cardioEntries}
            exerciseId={nav.selectedExerciseId ?? null}
            onBack={goHome}
            onSave={handleCardioSave}
          />
        );
      case 'history':
        return (
          <HistoryScreen appState={appState} onBack={goHome} initialExpandedDateKey={historyInitialDateKey} />
        );
      case 'progress':
        return <ProgressScreen appState={appState} onBack={goHome} />;
      case 'analysis':
        return <AnalysisScreen language={language} onBack={goHome} />;
      case 'repMax':
        return <RepMaxScreen appState={appState} onBack={goHome} />;
      case 'quickLog':
        return (
          <QuickLogScreen
            appState={appState}
            onBack={goHome}
            onSave={handleQuickLogSave}
            onLogSet={handleQuickLogSet}
            onCategorizeExercise={categorizeExercise}
            showLocalOnlyNotice={nav.showLocalOnlyNotice ?? false}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            appState={appState}
            onBack={goHome}
            onUpdate={updateProfile}
            onOpenLogin={goToLogin}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            appState={appState}
            onBack={goHome}
            onUpdate={updateSettings}
            onOpenManageExercises={goToManageExercises}
          />
        );
      case 'manageExercises':
        return <ManageExercisesScreen appState={appState} onBack={goToSettings} onMerge={mergeExercisesById} />;
      default:
        return assertNever(nav.screen);
    }
  })();

  return (
    <SafeAreaProvider>
      <BackSwipeContext.Provider value={backSwipeContextValue}>
        <View style={styles.appContainer} {...panHandlers}>
          <StatusBar barStyle="light-content" />
          <ExpoStatusBar style="light" />
          <ErrorBoundary>{screen}</ErrorBoundary>
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
