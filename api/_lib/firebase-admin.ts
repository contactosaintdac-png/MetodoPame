import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

const EMULATOR_PROJECT_ID = 'demo-metodo-pame';

function isEmulatorMode(): boolean {
  return Boolean(
    process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST,
  );
}

function resolveProjectId(): string {
  if (isEmulatorMode()) {
    const projectId =
      process.env.GCLOUD_PROJECT ||
      process.env.FIREBASE_PROJECT_ID ||
      EMULATOR_PROJECT_ID;

    if (projectId !== EMULATOR_PROJECT_ID) {
      throw new Error(
        `Firebase Emulator must use project ${EMULATOR_PROJECT_ID}; received ${projectId}`,
      );
    }

    return projectId;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is required');
  return projectId;
}

function createAdminApp(): App {
  const projectId = resolveProjectId();

  if (isEmulatorMode()) return initializeApp({ projectId });

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    return initializeApp({
      projectId,
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  return initializeApp({ projectId, credential: applicationDefault() });
}

export function getFirebaseAdminApp(): App {
  return getApps()[0] ?? createAdminApp();
}

export function getAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(getFirebaseAdminApp());
}

export { EMULATOR_PROJECT_ID };
