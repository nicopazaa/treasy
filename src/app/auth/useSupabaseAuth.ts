import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { AuthChangeEvent, Session } from '@supabase/auth-js';
import type { AppState } from '../../features/workouts';
import type { AppStatePersister } from '../state/persist';
import type { NavState } from '../navigation/types';
import { t } from '../../shared/i18n/i18n';
import { getSupabaseClient, isSupabaseConfigured, readSupabaseIdentity } from './supabaseClient';

type UseSupabaseAuthArgs = {
  appState: AppState;
  loading: boolean;
  navigate: (screen: NavState['screen'], params?: Partial<NavState>) => void;
  persister: AppStatePersister;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
};

type UseSupabaseAuthResult = {
  accessToken: string | null;
  authBusy: boolean;
  clearLoginError: () => void;
  enabled: boolean;
  loginError: string | null;
  startGithubLogin: () => Promise<boolean>;
};

function deriveNextState(prev: AppState, session: Session): AppState {
  const identity = readSupabaseIdentity(session.user);
  const nickname =
    prev.nickname && prev.nickname.trim().length > 0 ? prev.nickname.trim() : identity.nickname;

  const authProvider = identity.authProvider === 'email'
    ? prev.authProvider === 'github'
      ? prev.authProvider
      : 'email'
    : identity.authProvider;

  const nextState: AppState = {
    ...prev,
    userId: identity.userId,
    userEmail: identity.userEmail,
    nickname,
    onboarded: true,
    authProvider,
  };

  if (
    nextState.userId === prev.userId &&
    nextState.userEmail === prev.userEmail &&
    nextState.nickname === prev.nickname &&
    nextState.onboarded === prev.onboarded &&
    nextState.authProvider === prev.authProvider
  ) {
    return prev;
  }

  return nextState;
}

export function useSupabaseAuth(args: UseSupabaseAuthArgs): UseSupabaseAuthResult {
  const { appState, loading, navigate, persister, setAppState } = args;
  const client = useMemo(getSupabaseClient, []);
  const enabled = useMemo(isSupabaseConfigured, []);
  const stateRef = useRef(appState);
  const [authBusy, setAuthBusy] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    stateRef.current = appState;
  }, [appState]);

  const commitSession = useCallback(
    async (session: Session | null, source: 'bootstrap' | 'signin' | 'refresh') => {
      setAccessToken(session?.access_token ?? null);
      if (!session?.user) return;

      const prev = stateRef.current;
      const next = deriveNextState(prev, session);
      if (next !== prev) {
        stateRef.current = next;
        setAppState(next);
        await persister.saveNow(next);
      }

      if (!prev.onboarded && (source === 'signin' || source === 'bootstrap')) {
        navigate('quickLog');
      }
    },
    [navigate, persister, setAppState]
  );

  useEffect(() => {
    if (!enabled || !client || loading) return;
    let alive = true;
    setAuthBusy(true);

    void (async () => {
      try {
        const { data, error } = await client.getSession();
        if (!alive) return;
        if (error) {
          throw error;
        }
        await commitSession(data.session ?? null, 'bootstrap');
      } catch (error) {
        if (!alive) return;
        console.warn('Failed to hydrate Supabase session', error);
      } finally {
        if (alive) {
          setAuthBusy(false);
        }
      }
    })();

    const {
      data: { subscription },
    } = client.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      const source =
        event === 'SIGNED_IN' ? 'signin' :
        event === 'TOKEN_REFRESHED' ? 'refresh' :
        'bootstrap';

      void commitSession(session, source);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [client, commitSession, enabled, loading]);

  const clearLoginError = useCallback(() => {
    setLoginError(null);
  }, []);

  const startGithubLogin = useCallback(async (): Promise<boolean> => {
    if (!enabled || !client) return false;
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setLoginError(t(stateRef.current.language ?? 'en', 'githubWebOnly'));
      return true;
    }

    clearLoginError();
    setAuthBusy(true);
    try {
      const redirectTo = window.location.origin;
      const { data, error } = await client.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo,
          scopes: 'read:user user:email',
        },
      });

      if (error) {
        throw error;
      }

      // Web OAuth usually redirects away immediately. Returning truthy signals that
      // Supabase handled the login request and fallback should not run.
      return Boolean(data?.url ?? redirectTo);
    } catch (error) {
      console.warn('Supabase GitHub login failed', error);
      setLoginError(t(stateRef.current.language ?? 'en', 'githubFailed'));
      setAuthBusy(false);
      return true;
    }
  }, [clearLoginError, client, enabled]);

  return {
    enabled,
    authBusy,
    accessToken,
    loginError,
    clearLoginError,
    startGithubLogin,
  };
}
