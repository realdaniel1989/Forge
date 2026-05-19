import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app;
let db: ReturnType<typeof getFirestore>;
let auth: ReturnType<typeof getAuth>;
let initError: string | null = null;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  auth = getAuth(app);
} catch (e) {
  initError = e instanceof Error ? e.message : String(e);
  console.error('Firebase initialization failed:', initError);
}

export { db, auth, initError };
