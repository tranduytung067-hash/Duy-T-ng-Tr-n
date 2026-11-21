import { SheetDataState, UserPermission, ThiDuaBlock, InventoryItem } from '../types';

/**
 * FMCG Sheet Data Caching & Background Sync Manager
 * Powered by IndexedDB with in-memory caching and localStorage metadata fallback.
 */

const DB_NAME = 'FMCG_SHEET_CACHE_V2';
const DB_VERSION = 1;

// Object Store names
const STORE_SHEET_DATA = 'sheet_data';
const STORE_RAW_TABS = 'raw_tabs';
const STORE_MODULES = 'module_data';
const STORE_META = 'meta_data';

// In-Memory Fast Cache Map
const memoryCache = new Map<string, { data: any; timestamp: number; hash?: string }>();

// In-Flight Request Deduplication Map
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Opens or initializes the IndexedDB database safely
 */
function openDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_SHEET_DATA)) {
          db.createObjectStore(STORE_SHEET_DATA, { keyPath: 'sheetId' });
        }
        if (!db.objectStoreNames.contains(STORE_RAW_TABS)) {
          db.createObjectStore(STORE_RAW_TABS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_MODULES)) {
          db.createObjectStore(STORE_MODULES, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = (err) => {
        console.warn('IndexedDB open error, falling back to memory/localStorage:', err);
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB not supported or disabled:', e);
      resolve(null);
    }
  });
}

/**
 * Fast DJB2 hash generator for checking content changes
 */
export function generateDataHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Save parsed SheetDataState to IndexedDB & Memory Cache
 */
export async function setCachedSheetData(sheetId: string, data: SheetDataState, hash?: string): Promise<void> {
  if (!sheetId || !data) return;

  const timestamp = Date.now();
  const cacheObj = {
    sheetId,
    data,
    timestamp,
    hash: hash || generateDataHash(JSON.stringify(data.employees?.length + '_' + data.transactions?.length + '_' + data.lastUpdated)),
    lastUpdated: data.lastUpdated || new Date().toISOString()
  };

  // 1. In-Memory Cache
  memoryCache.set(`sheet_${sheetId}`, { data, timestamp, hash: cacheObj.hash });

  // 2. LocalStorage fast timestamp pointer
  try {
    localStorage.setItem(`gs_cache_time_${sheetId}`, String(timestamp));
    localStorage.setItem(`gs_cache_hash_${sheetId}`, cacheObj.hash);
    if (data.lastUpdated) {
      localStorage.setItem(`gs_cache_updated_${sheetId}`, data.lastUpdated);
    }
  } catch (e) {
    // Ignore localStorage quota errors
  }

  // 3. IndexedDB for large full dataset
  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_SHEET_DATA, 'readwrite');
      const store = tx.objectStore(STORE_SHEET_DATA);
      store.put(cacheObj);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Retrieve cached SheetDataState (Memory -> IndexedDB)
 */
export async function getCachedSheetData(sheetId: string): Promise<SheetDataState | null> {
  if (!sheetId) return null;

  // 1. Check in-memory cache first
  const mem = memoryCache.get(`sheet_${sheetId}`);
  if (mem && mem.data) {
    return mem.data;
  }

  // 2. Read from IndexedDB
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_SHEET_DATA, 'readonly');
      const store = tx.objectStore(STORE_SHEET_DATA);
      const req = store.get(sheetId);

      req.onsuccess = () => {
        if (req.result && req.result.data) {
          // Populate in-memory cache for subsequent instant synchronous reads
          memoryCache.set(`sheet_${sheetId}`, {
            data: req.result.data,
            timestamp: req.result.timestamp,
            hash: req.result.hash
          });
          resolve(req.result.data);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Get raw tab cached data
 */
export async function getCachedRawTab(sheetId: string, tabName: string, range = ''): Promise<{ rows: any[]; hash?: string; timestamp: number } | null> {
  const key = `${sheetId}__${tabName}__${range}`;
  
  // 1. Memory check
  const mem = memoryCache.get(`tab_${key}`);
  if (mem && mem.data) {
    return { rows: mem.data, hash: mem.hash, timestamp: mem.timestamp };
  }

  // 2. IndexedDB check
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RAW_TABS, 'readonly');
      const store = tx.objectStore(STORE_RAW_TABS);
      const req = store.get(key);

      req.onsuccess = () => {
        if (req.result && req.result.rows) {
          memoryCache.set(`tab_${key}`, {
            data: req.result.rows,
            hash: req.result.hash,
            timestamp: req.result.timestamp
          });
          resolve({
            rows: req.result.rows,
            hash: req.result.hash,
            timestamp: req.result.timestamp
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Set raw tab cached data
 */
export async function setCachedRawTab(sheetId: string, tabName: string, rows: any[], hash?: string, range = ''): Promise<void> {
  const key = `${sheetId}__${tabName}__${range}`;
  const timestamp = Date.now();

  memoryCache.set(`tab_${key}`, { data: rows, timestamp, hash });

  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RAW_TABS, 'readwrite');
      const store = tx.objectStore(STORE_RAW_TABS);
      store.put({ key, rows, hash, timestamp });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Module-level Caching (e.g. Thi Đua, Tồn Kho, Trưng Bày, Kích Hoạt)
 */
export async function getCachedModuleData<T>(moduleKey: string, sheetId: string): Promise<T | null> {
  const key = `${moduleKey}__${sheetId}`;

  // 1. Memory check
  const mem = memoryCache.get(`mod_${key}`);
  if (mem && mem.data) {
    return mem.data as T;
  }

  // 2. IndexedDB check
  const db = await openDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MODULES, 'readonly');
      const store = tx.objectStore(STORE_MODULES);
      const req = store.get(key);

      req.onsuccess = () => {
        if (req.result && req.result.data) {
          memoryCache.set(`mod_${key}`, { data: req.result.data, timestamp: req.result.timestamp });
          resolve(req.result.data as T);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function setCachedModuleData<T>(moduleKey: string, sheetId: string, data: T): Promise<void> {
  const key = `${moduleKey}__${sheetId}`;
  const timestamp = Date.now();

  memoryCache.set(`mod_${key}`, { data, timestamp });

  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_MODULES, 'readwrite');
      const store = tx.objectStore(STORE_MODULES);
      store.put({ key, data, timestamp });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Deduplicate concurrent in-flight HTTP requests
 */
export function getOrCreateInFlightRequest<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key) as Promise<T>;
  }

  const promise = fetcher()
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * Check if the browser currently has internet connectivity
 */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

/**
 * Clears all cached Google Sheet data
 */
export async function clearAllSheetCache(): Promise<void> {
  memoryCache.clear();
  inFlightRequests.clear();

  const db = await openDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction([STORE_SHEET_DATA, STORE_RAW_TABS, STORE_MODULES, STORE_META], 'readwrite');
      tx.objectStore(STORE_SHEET_DATA).clear();
      tx.objectStore(STORE_RAW_TABS).clear();
      tx.objectStore(STORE_MODULES).clear();
      tx.objectStore(STORE_META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
