import admin from 'firebase-admin';
import fs from 'fs';

const credentials = JSON.parse(fs.readFileSync('C:\\Users\\leshx\\.gemini\\prospectadac-firebase-adminsdk-fbsvc-02b8129179.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(credentials)
  });
}

const db = admin.firestore();

async function dumpAll() {
  console.log('--- USERS ---');
  const usersSnap = await db.collection('users').get();
  for (const userDoc of usersSnap.docs) {
    console.log(`User: ${userDoc.id} => Name: ${userDoc.data().name}, Email: ${userDoc.data().email}, Role: ${userDoc.data().role}`);
    
    // Fetch bookings for this user
    const bookingsSnap = await userDoc.ref.collection('bookings').get();
    if (bookingsSnap.empty) {
      console.log('  No bookings found for this user.');
    } else {
      bookingsSnap.docs.forEach(b => {
        console.log(`  Booking: ${b.id} => Date: ${b.data().date}, Client: ${b.data().name}, Employee: ${b.data().assignedEmployeeName}, Status: ${b.data().status}, TotalPrice: ${b.data().totalPrice}`);
      });
    }
  }

  console.log('--- GENERAL COLLECTION GROUP BOOKINGS ---');
  try {
    const cgSnap = await db.collectionGroup('bookings').get();
    console.log(`Found ${cgSnap.size} bookings using collectionGroup`);
    cgSnap.docs.forEach(doc => {
      console.log(`  Path: ${doc.ref.path} => Date: ${doc.data().date}, Client: ${doc.data().name}`);
    });
  } catch (err) {
    console.error('Error fetching collectionGroup bookings:', err);
  }
}

dumpAll().catch(console.error);
