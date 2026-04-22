export type ThemeMode = 'darkBlue' | 'calmLight' | 'light' | 'dark';

export type AuthProvider = 'guest' | 'email' | 'github';

export type AppLanguage = 'en' | 'nb' | 'es';

// Local-first sync lifecycle flag for backend readiness.
export type SyncStatus = 'local' | 'pending' | 'synced' | 'failed';

export type SyncEntityType = 'exercise' | 'set' | 'cardio' | 'log' | 'note';
export type SyncOperation = 'upsert' | 'delete';

export interface SyncOutboxEvent {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  clientId: string;
  operation: SyncOperation;
  version: number;
  changedAt: string;
}

export interface SyncTombstone {
  entityType: SyncEntityType;
  entityId: string;
  clientId: string;
  version: number;
  deletedAt: string;
}

export interface SyncState {
  schemaVersion: 1;
  outbox: SyncOutboxEvent[];
  tombstones: SyncTombstone[];
}
