import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { getFirebaseEmulatorConfig } from './firebase-emulator';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "dummy-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dummy-auth-domain.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dummy-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dummy-bucket.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcde",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

const emulatorConfig = getFirebaseEmulatorConfig({
  VITE_USE_FIREBASE_EMULATORS: import.meta.env.VITE_USE_FIREBASE_EMULATORS,
  VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
});
const emulatorState = globalThis as typeof globalThis & {
  __metodoPameFirebaseEmulatorsConnected?: boolean;
};
if (emulatorConfig && !emulatorState.__metodoPameFirebaseEmulatorsConnected) {
  connectAuthEmulator(auth, emulatorConfig.authUrl, { disableWarnings: true });
  connectFirestoreEmulator(
    db,
    emulatorConfig.firestoreHost,
    emulatorConfig.firestorePort,
  );
  emulatorState.__metodoPameFirebaseEmulatorsConnected = true;
}
