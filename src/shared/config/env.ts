function readEnv(name: string): string | null {
  if (!name) return null;
  if (typeof process === 'undefined' || !process.env) return null;
  const value = process.env[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getExpoPublicGithubClientId(): string | null {
  return readEnv('EXPO_PUBLIC_GITHUB_CLIENT_ID');
}

export function getExpoPublicSupabaseUrl(): string | null {
  return readEnv('EXPO_PUBLIC_SUPABASE_URL');
}

export function getExpoPublicSupabasePublishableKey(): string | null {
  return readEnv('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
}

export function getExpoPublicSyncEndpoint(): string | null {
  return readEnv('EXPO_PUBLIC_SYNC_ENDPOINT');
}

export function getExpoPublicSyncBatchSize(): number {
  return readPositiveIntEnv('EXPO_PUBLIC_SYNC_BATCH_SIZE', 25);
}

export function getExpoPublicSyncTimeoutMs(): number {
  return readPositiveIntEnv('EXPO_PUBLIC_SYNC_TIMEOUT_MS', 12000);
}

export function getExpoPublicSyncRetryBaseMs(): number {
  return readPositiveIntEnv('EXPO_PUBLIC_SYNC_RETRY_BASE_MS', 1500);
}

export function getExpoPublicSyncRetryMaxMs(): number {
  return readPositiveIntEnv('EXPO_PUBLIC_SYNC_RETRY_MAX_MS', 30000);
}
