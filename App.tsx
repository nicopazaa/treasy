import React, { useCallback, useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, StatusBar } from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { installGlobalTypography } from './src/shared/theme/typography';

import { LandingScreen } from './src/screens/LandingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { BlockScreen } from './src/screens/BlockScreen';
import { AIScreen } from './src/screens/AIScreen';
import { CardioScreen } from './src/screens/CardioScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { ProgressScreen } from './src/screens/ProgressScreen';
import { RepMaxScreen } from './src/screens/RepMaxScreen';
import { AnalysisScreen } from './src/screens/AnalysisScreen';
import { QuickLogScreen } from './src/screens/QuickLogScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ManageExercisesScreen } from './src/screens/ManageExercisesScreen';
import { NotertScreen } from './src/screens/NotertScreen';

import { ErrorBoundary } from './src/app/ErrorBoundary';
import { useAppActions } from './src/app/actions/useAppActions';
import { BackSwipeContext } from './src/app/navigation/BackSwipeContext';
import type { NavState } from './src/app/navigation/types';
import { useNavStack } from './src/app/navigation/useNavStack';
import { useAppStore } from './src/app/state/useAppStore';
import { useDerivedCache } from './src/app/state/useDerivedCache';
import { assertNever } from './src/shared/assert';
import { normalizeThemeMode } from './src/shared/theme/themes';

installGlobalTypography();

export default function App() {
  const [fontsLoaded, fontsError] = useFonts({
    'Inter-Regular': require('./assets/fonts/Inter-Regular.ttf'),
    'Inter-SemiBold': require('./assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('./assets/fonts/Inter-Bold.ttf'),
  });
  const fontsReady = fontsLoaded || Boolean(fontsError);

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
    finishWorkoutSession,
    updateSettings,
    setThemeMode,
    reorderExercises,
    moveExercise,
    addExerciseToBlock,
    renameExerciseById,
    deleteExerciseById,
    restoreExerciseEntry,
    addSetToExercise,
    categorizeExercise,
    saveCardio,
    mergeExercisesById,
  } = actions;

  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';

  const currentBlock = nav.selectedBlockId ? appState.blocks.find((b) => b.id === nav.selectedBlockId) : null;
  const currentBlockId = currentBlock?.id ?? null;

  const goHome = useCallback(() => navigate('home'), [navigate]);
  const goToLogin = useCallback(() => navigate('login'), [navigate]);
  const goToSettings = useCallback(() => navigate('settings'), [navigate]);
  const goToManageExercises = useCallback(() => navigate('manageExercises'), [navigate]);

  const handleLandingLogin = goToLogin;

  const handleLoginBack = useCallback(() => {
    navigate(appState.onboarded ? 'settings' : 'landing');
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
  const handleHomeOpenSettings = useCallback(() => navigate('settings'), [navigate]);
  const handleHomeOpenProgress = useCallback(() => navigate('progress'), [navigate]);
  const handleHomeOpenRepMax = useCallback(() => navigate('repMax'), [navigate]);
  const handleHomeOpenAnalysis = useCallback(() => navigate('analysis'), [navigate]);
  const handleHomeOpenNotert = useCallback(() => navigate('notert'), [navigate]);

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

  if (loading || authBusy || !fontsReady) {
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
            onOpenSettings={handleHomeOpenSettings}
            onOpenHistory={openHistory}
            onOpenHistoryForDate={openHistoryForDate}
            onOpenProgress={handleHomeOpenProgress}
            onOpenRepMax={handleHomeOpenRepMax}
            onOpenAnalysis={handleHomeOpenAnalysis}
            onStartCardio={handleStartCardio}
            onOpenNotert={handleHomeOpenNotert}
            onAddNote={handleAddNote}
            onFinishWorkout={finishWorkoutSession}
            onSetTheme={setThemeMode}
          />
        );
      case 'block':
        if (!currentBlock) return null;
        return (
          <BlockScreen
            language={language}
            themeMode={appState.theme}
            massUnit={massUnit}
            block={currentBlock}
            exercises={derivedCache.exercisesByBlockId.get(currentBlock.id) ?? []}
            sets={appState.sets}
            setsByExerciseId={derivedCache.setsByExerciseId}
            allBlocks={appState.blocks}
            onBack={goHome}
            onAddSetToExercise={addSetToExercise}
            onReorderExercises={handleBlockReorderExercises}
            onMoveExercise={moveExercise}
            onAddExercise={handleBlockAddExercise}
            onRenameExercise={renameExerciseById}
            onDeleteExercise={deleteExerciseById}
            onRestoreExercise={restoreExerciseEntry}
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
        return <AnalysisScreen appState={appState} derivedCache={derivedCache} onBack={goHome} />;
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
      case 'settings':
        return (
          <SettingsScreen
            appState={appState}
            onBack={goHome}
            onUpdate={updateSettings}
            onOpenLogin={goToLogin}
            onOpenManageExercises={goToManageExercises}
          />
        );
      case 'manageExercises':
        return <ManageExercisesScreen appState={appState} onBack={goToSettings} onMerge={mergeExercisesById} />;
      case 'notert':
        return <NotertScreen language={language} themeMode={appState.theme} onBack={goHome} />;
      default:
        return assertNever(nav.screen);
    }
  })();
  const useCalmThemeChrome =
    (nav.screen === 'home' || nav.screen === 'block' || nav.screen === 'notert') &&
    normalizeThemeMode(appState.theme) === 'calmLight';
  const statusBarStyle = useCalmThemeChrome ? 'dark-content' : 'light-content';
  const expoStatusBarStyle = useCalmThemeChrome ? 'dark' : 'light';

  return (
    <SafeAreaProvider>
      <BackSwipeContext.Provider value={backSwipeContextValue}>
        <View style={[styles.appContainer, useCalmThemeChrome ? styles.appContainerLight : null]} {...panHandlers}>
          <StatusBar barStyle={statusBarStyle} />
          <ExpoStatusBar style={expoStatusBarStyle} />
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
  appContainerLight: {
    backgroundColor: '#F5F2EC',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
