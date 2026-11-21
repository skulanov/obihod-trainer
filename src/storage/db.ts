import type {
  ActiveQuizSession,
  TrainingSessionRecord,
  UserPreferences,
} from '../domain/types.ts';

const DB_NAME = 'obihod_trainer_db';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_KV = 'kv';
const ACTIVE_SESSION_KEY = 'active_session';
const PREFS_KEY = 'user_preferences';

const LS_PREFIX = 'obihod_trainer_v1_';

export const DEFAULT_PREFERENCES: UserPreferences = {
  lastCategory: 'trop',
  lastGlasesByCategory: {
    trop: [],
    stih: [],
  },
  lastMode: 'finite',
};

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
        store.createIndex('finishedAt', 'finishedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open error'));
  });
}

function lsRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsWrite(key: string, value: unknown): void {
  try {
    if (value === null || value === undefined) {
      window.localStorage.removeItem(LS_PREFIX + key);
    } else {
      window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    }
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export async function loadActiveSession(): Promise<ActiveQuizSession | null> {
  if (!hasIndexedDb()) {
    return lsRead<ActiveQuizSession | null>(ACTIVE_SESSION_KEY, null);
  }
  try {
    const db = await openDatabase();
    return await new Promise<ActiveQuizSession | null>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const req = tx.objectStore(STORE_KV).get(ACTIVE_SESSION_KEY);
      req.onsuccess = () => resolve((req.result as ActiveQuizSession | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return lsRead<ActiveQuizSession | null>(ACTIVE_SESSION_KEY, null);
  }
}

export async function saveActiveSession(session: ActiveQuizSession | null): Promise<void> {
  lsWrite(ACTIVE_SESSION_KEY, session);
  if (!hasIndexedDb()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readwrite');
      const store = tx.objectStore(STORE_KV);
      if (session === null) {
        store.delete(ACTIVE_SESSION_KEY);
      } else {
        store.put(session, ACTIVE_SESSION_KEY);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback already persisted to localStorage
  }
}

export async function loadPreferences(): Promise<UserPreferences> {
  const fromLs = lsRead<UserPreferences | null>(PREFS_KEY, null);
  if (!hasIndexedDb()) {
    return fromLs ? { ...DEFAULT_PREFERENCES, ...fromLs } : DEFAULT_PREFERENCES;
  }
  try {
    const db = await openDatabase();
    const res = await new Promise<UserPreferences | null>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const req = tx.objectStore(STORE_KV).get(PREFS_KEY);
      req.onsuccess = () => resolve((req.result as UserPreferences | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (res) return { ...DEFAULT_PREFERENCES, ...res };
    return fromLs ? { ...DEFAULT_PREFERENCES, ...fromLs } : DEFAULT_PREFERENCES;
  } catch {
    return fromLs ? { ...DEFAULT_PREFERENCES, ...fromLs } : DEFAULT_PREFERENCES;
  }
}

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  lsWrite(PREFS_KEY, prefs);
  if (!hasIndexedDb()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readwrite');
      tx.objectStore(STORE_KV).put(prefs, PREFS_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback already saved
  }
}

export async function loadSessionHistory(): Promise<TrainingSessionRecord[]> {
  if (!hasIndexedDb()) {
    const list = lsRead<TrainingSessionRecord[]>(STORE_SESSIONS, []);
    return [...list].sort((a, b) => b.finishedAt - a.finishedAt);
  }
  try {
    const db = await openDatabase();
    const list = await new Promise<TrainingSessionRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readonly');
      const req = tx.objectStore(STORE_SESSIONS).getAll();
      req.onsuccess = () => resolve((req.result as TrainingSessionRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    return list.sort((a, b) => b.finishedAt - a.finishedAt);
  } catch {
    const list = lsRead<TrainingSessionRecord[]>(STORE_SESSIONS, []);
    return [...list].sort((a, b) => b.finishedAt - a.finishedAt);
  }
}

export async function saveSessionRecord(record: TrainingSessionRecord): Promise<void> {
  const existingLs = lsRead<TrainingSessionRecord[]>(STORE_SESSIONS, []).filter(
    (item) => item.id !== record.id
  );
  lsWrite(STORE_SESSIONS, [record, ...existingLs]);

  if (!hasIndexedDb()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      tx.objectStore(STORE_SESSIONS).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback already saved
  }
}

export async function clearAllHistory(): Promise<void> {
  lsWrite(STORE_SESSIONS, []);
  if (!hasIndexedDb()) return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SESSIONS, 'readwrite');
      tx.objectStore(STORE_SESSIONS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback cleared
  }
}
