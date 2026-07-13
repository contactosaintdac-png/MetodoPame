import dotenv from 'dotenv';
import admin from 'firebase-admin';
import path from 'path';

// Load environment variables from .env.vercel, .env.local or .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.vercel') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('ERROR: Falta configurar las variables de entorno de Firebase Admin en .env.local');
  console.error('Asegúrate de correr: npx vercel env pull .env.local');
  console.error('Variables requeridas: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  }),
});

const db = admin.firestore();
const auth = admin.auth();

async function migrate() {
  console.log('Iniciando migración de especialistas en Firestore...');
  
  // 1. Obtener todas las especialistas actuales
  const empSnap = await db.collection('employees').get();
  console.log(`Se encontraron ${empSnap.size} documentos en la colección 'employees'.`);
  
  for (const doc of empSnap.docs) {
    const employeeId = doc.id;
    const employeeData = doc.data();
    
    if (!employeeData.email) {
      console.log(`[Saltado] Documento ${employeeId} no tiene email.`);
      continue;
    }
    
    try {
      // 2. Buscar el usuario correspondiente en Firebase Auth por email
      const userRecord = await auth.getUserByEmail(employeeData.email);
      const authUid = userRecord.uid;
      
      if (employeeId === authUid) {
        console.log(`[Ok] Especialista ${employeeData.name} (${employeeData.email}) ya usa su UID como ID de documento.`);
        continue;
      }
      
      console.log(`[Migrando] ${employeeData.name} (${employeeData.email}): Document ID ${employeeId} -> UID ${authUid}`);
      
      // 3. Crear el nuevo documento usando el UID como ID
      await db.collection('employees').doc(authUid).set({
        ...employeeData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      // 4. Copiar disponibilidad / agendas si existen en la colección employee_schedules
      const scheduleSnap = await db.collection('employee_schedules').doc(employeeId).collection('blocks').get();
      if (!scheduleSnap.empty) {
        console.log(`   Copiando disponibilidad (${scheduleSnap.size} bloqueos)...`);
        for (const blockDoc of scheduleSnap.docs) {
          await db.collection('employee_schedules').doc(authUid).collection('blocks').doc(blockDoc.id).set(blockDoc.data());
          // Opcional: eliminar el bloqueo viejo
          await db.collection('employee_schedules').doc(employeeId).collection('blocks').doc(blockDoc.id).delete();
        }
      }
      
      // 5. Actualizar referencias en bookings
      // Buscamos bookings que tengan asignado este employeeId (usando collectionGroup)
      const bookingsSnap = await db.collectionGroup('bookings').where('assignedEmployeeId', '==', employeeId).get();
      if (!bookingsSnap.empty) {
        console.log(`   Actualizando asignaciones en ${bookingsSnap.size} reservas...`);
        for (const bookingDoc of bookingsSnap.docs) {
          await bookingDoc.ref.update({
            assignedEmployeeId: authUid,
          });
        }
      }
      
      // 6. Eliminar el documento original con auto-ID
      await db.collection('employees').doc(employeeId).delete();
      console.log(`[Completado] Migración exitosa de ${employeeData.name}.`);
      
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        console.warn(`[Advertencia] No existe cuenta de Auth para ${employeeData.email}. Se deja como está.`);
      } else {
        console.error(`[Error] Error al migrar especialista ${employeeId}:`, err);
      }
    }
  }
  
  console.log('Migración finalizada.');
}

migrate().catch(console.error);
