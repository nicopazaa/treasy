import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import AuthClientCjs from '@supabase/auth-js/dist/main/AuthClient';
import type { User } from '@supabase/auth-js';
import type { AuthProvider } from '../../shared/types';
import {
  getExpoPublicSupabasePublishableKey,
  getExpoPublicSupabaseUrl,
} from '../../shared/config/env';

const AUTH_STORAGE_KEY = 'treasy_supabase_auth';

type StorageAdapter = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

type SupabaseIdentity = {
  authProvider: AuthProvider;
  nickname: string | null;
  userEmail: string | null;
  userId: string;
};

type SupabaseAuthClient = InstanceType<typeof AuthClientCjs>;

let cachedClient: SupabaseAuthClient | null | undefined;

function createStorageAdapter(): StorageAdapter | undefined {
  if (Platform.OS === 'web') return undefined;
  return {
    getItem: async (key: string) => AsyncStorage.getItem(`${AUTH_STORAGE_KEY}:${key}`),
    setItem: async (key: string, value: string) => {
      await AsyncStorage.setItem(`${AUTH_STORAGE_KEY}:${key}`, value);
    },
    removeItem: async (key: string) => {
      await AsyncStorage.removeItem(`${AUTH_STORAGE_KEY}:${key}`);
    },
  };
}

export function getSupabaseClient(): SupabaseAuthClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const url = getExpoPublicSupabaseUrl();
  const publishableKey = getExpoPublicSupabasePublishableKey();
  if (!url || !publishableKey) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = new AuthClientCjs({
    url: `${url.replace(/\/$/, '')}/auth/v1`,
    headers: {
      apikey: publishableKey,
    },
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
    persistSession: true,
    storage: createStorageAdapter(),
  });
  return cachedClient;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseClient());
}

function normalizeProvider(rawProvider: unknown): AuthProvider {
  const provider = typeof rawProvider === 'string' ? rawProvider.trim().toLowerCase() : '';
  if (provider === 'github') return 'github';
  if (provider === 'email') return 'email';
  return 'email';
}

export function readSupabaseIdentity(user: User): SupabaseIdentity {
  const metadata = user.user_metadata ?? {};
  const nicknameCandidates = [
    metadata.user_name,
    metadata.preferred_username,
    metadata.full_name,
    metadata.name,
  ];
  const nickname =
    nicknameCandidates.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() ??
    null;

  return {
    userId: user.id,
    userEmail: typeof user.email === 'string' && user.email.trim().length > 0 ? user.email.trim().toLowerCase() : null,
    nickname,
    authProvider: normalizeProvider(user.app_metadata?.provider),
  };
}
