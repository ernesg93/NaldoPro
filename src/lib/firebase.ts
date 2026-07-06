import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Sólo apiKey, authDomain, projectId, messagingSenderId y appId son obligatorios.
// storageBucket es opcional (se omite si no se usa Firebase Storage).
const REQUIRED = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'] as const;
const missingKeys = REQUIRED.filter(k => !firebaseConfig[k]);

if (missingKeys.length > 0) {
  throw new Error(`Faltan variables de entorno requeridas para Firebase. Revisa tu configuración. Faltan: ${missingKeys.join(', ')}`);
}

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
