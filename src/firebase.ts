import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  setLogLevel, 
  doc, 
  collection, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  getDoc, 
  getDocs, 
  getDocFromServer,
  getDocsFromServer,
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import config from '../firebase-applet-config.json';
import { UserPermission } from './types';

// Set Firestore log level to silent to prevent noisy backend retry notices during sandboxed or offline execution
setLogLevel('silent');

const firebaseApp = initializeApp(config);

export const db = getFirestore(firebaseApp, config.firestoreDatabaseId);
export const auth = getAuth(firebaseApp);

export { 
  doc, 
  collection, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  onSnapshot, 
  getDoc, 
  getDocs, 
  getDocFromServer,
  getDocsFromServer,
  query, 
  where, 
  orderBy, 
  limit 
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const isOffline = error instanceof Error && (
    error.message.includes('offline') ||
    error.message.includes('unavailable') ||
    error.message.includes('Could not reach Cloud Firestore backend') ||
    (error as any)?.code === 'unavailable'
  );

  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };

  if (isOffline) {
    console.warn(`[Firestore Offline/Unavailable] ${operationType} on ${path}:`, error instanceof Error ? error.message : error);
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  if (operationType === OperationType.GET || operationType === OperationType.LIST) {
    console.warn(`[Firestore Read Warning] ${operationType} on ${path}:`, errInfo.error);
    return;
  }

  throw new Error(JSON.stringify(errInfo));
}

export async function saveUserPermissionToFirestore(p: UserPermission) {
  const path = `user_permissions/${p.email.toLowerCase().trim()}`;
  try {
    const emailKey = p.email.toLowerCase().trim();
    await setDoc(doc(db, 'user_permissions', emailKey), {
      email: p.email,
      password: p.password || '',
      role: p.role,
      mappedEmployee: p.mappedEmployee || '',
      hoVaTen: p.hoVaTen || '',
      vtbhCode: p.vtbhCode || '',
      channel: p.channel || '',
      locked: p.locked === true || (p as any).locked === 'true' || (p as any).locked === 'TRUE',
      avatarUrl: p.avatarUrl || '',
      soLuotTruyCap: p.soLuotTruyCap || 0
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteUserPermissionFromFirestore(email: string) {
  const path = `user_permissions/${email.toLowerCase().trim()}`;
  try {
    const emailKey = email.toLowerCase().trim();
    await setDoc(doc(db, 'user_permissions', emailKey), {
      emailKey: emailKey,
      email: email,
      deleted: true
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveSalesNoteToFirestore(employeeName: string, note: string, updatedBy: string) {
  const path = `sales_notes/${employeeName.toLowerCase().trim()}`;
  try {
    const docId = employeeName.toLowerCase().trim();
    await setDoc(doc(db, 'sales_notes', docId), {
      employeeName,
      note,
      updatedBy,
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export interface ThemeSettingsData {
  isNationalDayTheme?: boolean;
  nationalDayOpacity?: number;
  nationalDayCustomBgUrl?: string;
  headerBgColor?: string;
  headerTextColor?: string;
  headerStylePreset?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export async function saveThemeSettingsToFirestore(data: ThemeSettingsData) {
  const path = 'app_settings/theme';
  try {
    await setDoc(doc(db, 'app_settings', 'theme'), {
      ...data,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeThemeSettingsFromFirestore(callback: (data: ThemeSettingsData) => void) {
  const path = 'app_settings/theme';
  return onSnapshot(doc(db, 'app_settings', 'theme'), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data() as ThemeSettingsData);
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

export async function saveSectorIconsToFirestore(iconsMap: Record<string, any>, updatedBy: string) {
  const path = 'app_settings/sector_icons';
  try {
    await setDoc(doc(db, 'app_settings', 'sector_icons'), {
      icons: iconsMap,
      updatedBy,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeSectorIconsFromFirestore(callback: (iconsMap: Record<string, any>) => void) {
  const path = 'app_settings/sector_icons';
  return onSnapshot(doc(db, 'app_settings', 'sector_icons'), (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.data();
      if (data?.icons) {
        callback(data.icons);
      }
    }
  }, (err) => {
    handleFirestoreError(err, OperationType.GET, path);
  });
}

