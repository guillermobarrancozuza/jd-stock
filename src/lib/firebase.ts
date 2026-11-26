import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/* CRITICAL: The app will break without specifying firestoreDatabaseId */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

/**
 * Secondary Firebase Auth instance used solely by the Chief Admin when
 * creating a worker account directly from the Users Management panel,
 * so the Chief Admin's active session is never interrupted.
 */
export function getSecondaryAuth(): Auth {
  const secondaryName = 'jd-secondary-user-creator';
  const existing = getApps().find((a) => a.name === secondaryName);
  const secondaryApp = existing || initializeApp(firebaseConfig, secondaryName);
  return getAuth(secondaryApp);
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client appears offline, running in resilient mode.');
      return false;
    }
    // If permission or doc not found, still confirms server connectivity
    return true;
  }
}
