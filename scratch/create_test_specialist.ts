import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

async function run() {
  console.log('Starting test specialist creation...');
  console.log('Firebase project ID:', firebaseConfig.projectId);

  if (!firebaseConfig.apiKey) {
    console.error('Error: VITE_FIREBASE_API_KEY is not defined in .env.local');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const email = 'teste.funcionaria@metodopame.com';
  const password = 'Pame@2026!';
  const name = 'Especialista Teste';

  // 1. Create the user in Auth if they don't exist
  try {
    console.log(`Creating user in Firebase Auth: ${email}...`);
    await createUserWithEmailAndPassword(auth, email, password);
    console.log('Firebase Auth user created successfully!');
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      console.log('Firebase Auth user already exists. Proceeding to Firestore...');
    } else {
      console.error('Failed to create user in Auth:', err);
      process.exit(1);
    }
  }

  // 2. Create the document directly in Firestore 'employees' collection
  try {
    console.log('Creating Firestore employee document...');
    const docRef = await addDoc(collection(db, 'employees'), {
      name,
      email,
      phone: '(47) 99999-9999',
      whatsapp: '(47) 99999-9999',
      role: 'Especialista em Limpeza',
      status: 'pending',
      active: false,
      assignedServices: 0,
      weeklyAvailability: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=561668&color=fff`,
      createdAt: serverTimestamp(),
    });
    console.log('Firestore employee document created with ID:', docRef.id);
  } catch (err) {
    console.error('Failed to create Firestore employee document:', err);
    process.exit(1);
  }

  console.log('Successfully completed creating test specialist!');
  process.exit(0);
}

run();
