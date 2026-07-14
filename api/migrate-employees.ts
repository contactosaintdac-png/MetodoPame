import { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

let _db: admin.firestore.Firestore | null = null;
let _auth: admin.auth.Auth | null = null;

function initFirebase(): { db: admin.firestore.Firestore; auth: admin.auth.Auth } {
  if (_db && _auth) return { db: _db, auth: _auth };
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Firebase Admin credentials missing in Vercel env');
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
  _db = admin.firestore();
  _auth = admin.auth();
  return { db: _db, auth: _auth };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const { db, auth } = initFirebase();
    
    // 1. Verify token
    const decodedToken = await auth.verifyIdToken(token);
    const email = decodedToken.email;

    // 2. Authorize only admins
    const isAdmin = email && (
      email === 'metodopame.homedetail@gmail.com' ||
      email === 'contactosaintdac@gmail.com'
    );

    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden: only admins can migrate employees' });
    }

    const report: string[] = [];
    report.push('Iniciando migração de especialistas no Firestore...');

    // 3. Get all employees in Firestore
    const empSnap = await db.collection('employees').get();
    report.push(`Se encontraron ${empSnap.size} documentos en la colección 'employees'.`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const employeeDoc of empSnap.docs) {
      const employeeId = employeeDoc.id;
      const employeeData = employeeDoc.data();

      if (!employeeData.email) {
        report.push(`[Saltado] Documento ${employeeId} (${employeeData.name || 'Sin nombre'}) no tiene email.`);
        skippedCount++;
        continue;
      }

      try {
        // 4. Get corresponding user in Auth by email
        const userRecord = await auth.getUserByEmail(employeeData.email);
        const authUid = userRecord.uid;

        if (employeeId === authUid) {
          report.push(`[Ok] Especialista ${employeeData.name} (${employeeData.email}) ya usa su UID como ID de documento.`);
          continue;
        }

        report.push(`[Migrando] ${employeeData.name} (${employeeData.email}): Document ID ${employeeId} -> UID ${authUid}`);

        // 5. Create new document using UID as ID
        await db.collection('employees').doc(authUid).set({
          ...employeeData,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 6. Copy schedules/availability
        const scheduleSnap = await db.collection('employee_schedules').doc(employeeId).collection('blocks').get();
        if (!scheduleSnap.empty) {
          report.push(`   Copiando disponibilidad (${scheduleSnap.size} bloqueos)...`);
          for (const blockDoc of scheduleSnap.docs) {
            await db.collection('employee_schedules').doc(authUid).collection('blocks').doc(blockDoc.id).set(blockDoc.data());
            await db.collection('employee_schedules').doc(employeeId).collection('blocks').doc(blockDoc.id).delete();
          }
        }

        // 7. Update references in bookings
        const bookingsSnap = await db.collectionGroup('bookings').where('assignedEmployeeId', '==', employeeId).get();
        if (!bookingsSnap.empty) {
          report.push(`   Actualizando asignaciones en ${bookingsSnap.size} reservas...`);
          for (const bookingDoc of bookingsSnap.docs) {
            await bookingDoc.ref.update({
              assignedEmployeeId: authUid,
            });
          }
        }

        // 8. Delete original auto-ID document
        await db.collection('employees').doc(employeeId).delete();
        report.push(`[Completado] Migración exitosa de ${employeeData.name}.`);
        migratedCount++;

      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          report.push(`[Advertencia] No existe cuenta de Auth para ${employeeData.email}. Se deja como está.`);
          skippedCount++;
        } else {
          report.push(`[Error] Error al migrar especialista ${employeeId}: ${err.message || err}`);
          throw err;
        }
      }
    }

    return res.status(200).json({
      success: true,
      report,
      summary: {
        total: empSnap.size,
        migrated: migratedCount,
        skipped: skippedCount
      }
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
