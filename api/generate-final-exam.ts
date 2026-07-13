import { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

let _db: admin.firestore.Firestore | null = null;

function getDb(): admin.firestore.Firestore {
  if (_db) return _db;
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
  return _db;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  const { employeeId } = req.body;

  if (!employeeId) {
    return res.status(400).json({ error: 'Missing employeeId' });
  }

  try {
    const db = getDb();
    
    // 1. Verificar token y UID
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    if (uid !== employeeId) {
      return res.status(403).json({ error: 'Forbidden: UID mismatch' });
    }

    // 2. Verificar que la empleada esté activa
    const empDoc = await db.collection('employees').doc(employeeId).get();
    if (!empDoc.exists) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const empData = empDoc.data();
    if (!empData || empData.status !== 'active') {
      return res.status(403).json({ error: 'Employee is not active' });
    }

    // 3. Verificar resiliencia de conexión (intentos activos < 3 horas)
    const attemptsColl = db.collection('employees').doc(employeeId).collection('final_exam_attempts');
    const activeAttemptsQuery = await attemptsColl
      .where('gradedAt', '==', null)
      .orderBy('startedAt', 'desc')
      .limit(1)
      .get();

    if (!activeAttemptsQuery.empty) {
      const activeAttemptDoc = activeAttemptsQuery.docs[0];
      const activeAttemptData = activeAttemptDoc.data();
      const startedAt = activeAttemptData.startedAt.toDate();
      const now = new Date();
      const diffHours = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

      if (diffHours < 3.0) {
        console.log(`[generate-final-exam] Reanudando intento activo existente: ${activeAttemptDoc.id}`);
        return res.status(200).json({
          attemptId: activeAttemptDoc.id,
          questions: activeAttemptData.clientQuestions,
          resumed: true
        });
      } else {
        // Expirar el intento viejo automáticamente
        console.log(`[generate-final-exam] Expirando intento viejo: ${activeAttemptDoc.id}`);
        await activeAttemptDoc.ref.update({
          gradedAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          passed: false,
          scorePercent: 0,
          certificationLevel: null,
          isExpired: true
        });
      }
    }

    // 4. Verificar requisitos de módulos completados (los 15 modules con passed == true)
    const progressColl = db.collection('employees').doc(employeeId).collection('trainingProgress');
    const progressQuery = await progressColl.where('passed', '==', true).get();
    if (progressQuery.size < 15) {
      return res.status(400).json({ 
        error: 'Debe aprobar las evaluaciones de los 15 módulos antes de rendir el examen final.',
        modulesCompleted: progressQuery.size
      });
    }

    // 5. Verificar cooldown de 24 horas y límite mensual (máx 2 intentos)
    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    
    const pastAttemptsQuery = await attemptsColl
      .orderBy('startedAt', 'desc')
      .get();
      
    let monthlyAttemptsCount = 0;
    
    for (const doc of pastAttemptsQuery.docs) {
      const data = doc.data();
      const attemptDate = data.startedAt.toDate();
      
      // Cooldown de 24h
      const diffHours = (now.getTime() - attemptDate.getTime()) / (1000 * 60 * 60);
      if (diffHours < 24.0) {
        return res.status(429).json({ 
          error: `Debes esperar 24 horas antes de volver a rendir. Tu último intento fue hace ${Math.round(diffHours)} horas.` 
        });
      }

      // Límite mensual
      if (attemptDate >= oneMonthAgo) {
        monthlyAttemptsCount++;
      }
    }

    if (monthlyAttemptsCount >= 2) {
      return res.status(429).json({ 
        error: 'Has alcanzado el límite máximo de 2 intentos de examen final por mes.' 
      });
    }

    // 6. Componer examen final dinámicamente
    // Muestreo de evaluaciones por bloque
    const allEvaluationsSnap = await db.collection('evaluations').where('status', '==', 'published').get();
    const allEvaluations = allEvaluationsSnap.docs.map(doc => doc.data());

    const questionsByIdentity: any[] = [];
    const questionsByPostura: any[] = [];
    const questionsByConducta: any[] = [];
    const questionsByTecnica: any[] = [];
    const questionsByEstandar: any[] = [];
    const questionsByOperacion: any[] = [];

    allEvaluations.forEach(eva => {
      const modNum = parseInt(eva.moduleId.replace('mod_', ''));
      const evQuestions = eva.questions || [];

      if (modNum >= 1 && modNum <= 2) questionsByIdentity.push(...evQuestions);
      else if (modNum >= 3 && modNum <= 4) questionsByPostura.push(...evQuestions);
      else if (modNum >= 5 && modNum <= 7) questionsByConducta.push(...evQuestions);
      else if (modNum >= 8 && modNum <= 12) questionsByTecnica.push(...evQuestions);
      else if (modNum === 13) questionsByEstandar.push(...evQuestions);
      else if (modNum >= 14 && modNum <= 15) questionsByOperacion.push(...evQuestions);
    });

    const getRandomSample = (arr: any[], size: number) => {
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, size);
    };

    // Tomar las muestras aleatorias requeridas
    const sampledQuestions = [
      ...getRandomSample(questionsByIdentity, 4),
      ...getRandomSample(questionsByPostura, 4),
      ...getRandomSample(questionsByConducta, 6),
      ...getRandomSample(questionsByTecnica, 15),
      ...getRandomSample(questionsByEstandar, 3),
      ...getRandomSample(questionsByOperacion, 5)
    ];

    // Cargar preguntas de síntesis
    const finalExamQuestionsSnap = await db.collection('final_exam_questions').where('status', '==', 'published').get();
    const finalExamQuestions = finalExamQuestionsSnap.docs.map(doc => doc.data());
    sampledQuestions.push(...getRandomSample(finalExamQuestions, 3));

    // Si por algún motivo nos faltan preguntas (db vacía), tirar error amigable
    if (sampledQuestions.length === 0) {
      return res.status(500).json({ error: 'No se encontraron preguntas en la base de datos para generar el examen.' });
    }

    // Asegurar ID único y ordenar
    sampledQuestions.forEach((q, idx) => {
      q.order = idx + 1;
    });

    // Sanitizar preguntas para el cliente (eliminar respuestas correctas y palabras clave)
    const clientQuestions = sampledQuestions.map(q => {
      const { correctOptionIndex, expectedAnswerKeywords, ...rest } = q;
      return rest;
    });

    // 7. Guardar el intento de examen en Firestore (subcolección)
    const newAttemptRef = attemptsColl.doc();
    const attemptId = newAttemptRef.id;

    await newAttemptRef.set({
      id: attemptId,
      employeeId,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: null,
      gradedAt: null,
      questions: sampledQuestions, // Snapshot completo con respuestas correctas para corregir server-side
      clientQuestions, // Snapshot sanitizado para el cliente
      answers: [],
      scorePercent: null,
      passed: false,
      certificationLevel: null
    });

    return res.status(200).json({
      attemptId,
      questions: clientQuestions,
      resumed: false
    });

  } catch (error: any) {
    console.error('[generate-final-exam] Catch:', error);
    return res.status(500).json({ error: `Error interno: ${error.message || error}` });
  }
}
