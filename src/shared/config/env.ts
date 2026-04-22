function readEnv(name: string): string | null {
  if (!name) return null;
  if (typeof process === 'undefined' || !process.env) return null;
  const value = process.env[name];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getExpoPublicGithubClientId(): string | null {
  return readEnv('EXPO_PUBLIC_GITHUB_CLIENT_ID');
}
