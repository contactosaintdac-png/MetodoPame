interface EmulatorEnvironment {
  VITE_USE_FIREBASE_EMULATORS?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
}

export interface FirebaseEmulatorConfig {
  authUrl: string;
  firestoreHost: string;
  firestorePort: number;
}

export function getFirebaseEmulatorConfig(
  environment: EmulatorEnvironment,
): FirebaseEmulatorConfig | null {
  if (environment.VITE_USE_FIREBASE_EMULATORS !== 'true') return null;

  if (environment.VITE_FIREBASE_PROJECT_ID !== 'demo-metodo-pame') {
    throw new Error(
      'Firebase emulator mode requires VITE_FIREBASE_PROJECT_ID=demo-metodo-pame',
    );
  }

  return {
    authUrl: 'http://127.0.0.1:9099',
    firestoreHost: '127.0.0.1',
    firestorePort: 8080,
  };
}
