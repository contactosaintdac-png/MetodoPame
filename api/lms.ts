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

function cleanText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .trim();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const { db, auth } = initFirebase();
    const decodedToken = await auth.verifyIdToken(token);
    const userEmail = decodedToken.email;
    const uid = decodedToken.uid;

    if (action === 'generate-final-exam') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { employeeId } = req.body;
      if (!employeeId) return res.status(400).json({ error: 'Missing employeeId' });
      if (uid !== employeeId) return res.status(403).json({ error: 'Forbidden: UID mismatch' });

      // 2. Verificar que la empleada esté activa
      const empDoc = await db.collection('employees').doc(employeeId).get();
      if (!empDoc.exists) return res.status(404).json({ error: 'Employee not found' });
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

      // 4. Verificar requisitos de módulos completados
      const progressColl = db.collection('employees').doc(employeeId).collection('trainingProgress');
      const progressQuery = await progressColl.where('passed', '==', true).get();
      if (progressQuery.size < 15) {
        return res.status(400).json({ 
          error: 'Debe aprobar las evaluaciones de los 15 módulos antes de rendir el examen final.',
          modulesCompleted: progressQuery.size
        });
      }

      // 5. Verificar cooldown de 24 horas y límite mensual
      const now = new Date();
      const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      
      const pastAttemptsQuery = await attemptsColl
        .orderBy('startedAt', 'desc')
        .get();
        
      let monthlyAttemptsCount = 0;
      
      for (const doc of pastAttemptsQuery.docs) {
        const data = doc.data();
        const attemptDate = data.startedAt.toDate();
        
        const diffHours = (now.getTime() - attemptDate.getTime()) / (1000 * 60 * 60);
        if (diffHours < 24.0) {
          return res.status(429).json({ 
            error: `Debes esperar 24 horas antes de volver a rendir. Tu último intento fue hace ${Math.round(diffHours)} horas.` 
          });
        }

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

      const sampledQuestions = [
        ...getRandomSample(questionsByIdentity, 4),
        ...getRandomSample(questionsByPostura, 4),
        ...getRandomSample(questionsByConducta, 6),
        ...getRandomSample(questionsByTecnica, 15),
        ...getRandomSample(questionsByEstandar, 3),
        ...getRandomSample(questionsByOperacion, 5)
      ];

      const finalExamQuestionsSnap = await db.collection('final_exam_questions').where('status', '==', 'published').get();
      const finalExamQuestions = finalExamQuestionsSnap.docs.map(doc => doc.data());
      sampledQuestions.push(...getRandomSample(finalExamQuestions, 3));

      if (sampledQuestions.length === 0) {
        return res.status(500).json({ error: 'No se encontraron preguntas en la base de datos para generar el examen.' });
      }

      sampledQuestions.forEach((q, idx) => {
        q.order = idx + 1;
      });

      const clientQuestions = sampledQuestions.map(q => {
        const { correctOptionIndex, expectedAnswerKeywords, ...rest } = q;
        return rest;
      });

      const newAttemptRef = attemptsColl.doc();
      const attemptId = newAttemptRef.id;

      await newAttemptRef.set({
        id: attemptId,
        employeeId,
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        completedAt: null,
        gradedAt: null,
        questions: sampledQuestions,
        clientQuestions,
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

    } else if (action === 'grade-final-exam') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      const { employeeId, attemptId, answers } = req.body;
      if (!employeeId || !attemptId || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      if (uid !== employeeId) return res.status(403).json({ error: 'Forbidden: UID mismatch' });

      const attemptRef = db.collection('employees').doc(employeeId).collection('final_exam_attempts').doc(attemptId);
      const attemptDoc = await attemptRef.get();
      if (!attemptDoc.exists) return res.status(404).json({ error: 'Attempt not found' });

      const attemptData = attemptDoc.data();
      if (!attemptData) return res.status(500).json({ error: 'Attempt data is corrupt' });
      if (attemptData.gradedAt !== null) {
        return res.status(400).json({ error: 'Este examen ya ha sido calificado.' });
      }

      const startedAt = attemptData.startedAt.toDate();
      const now = new Date();
      const diffHours = (now.getTime() - startedAt.getTime()) / (1000 * 60 * 60);

      if (diffHours >= 3.0) {
        await attemptRef.update({
          gradedAt: admin.firestore.FieldValue.serverTimestamp(),
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          passed: false,
          scorePercent: 0,
          certificationLevel: null,
          isExpired: true
        });
        return res.status(400).json({ error: 'El tiempo límite de 3 horas para responder el examen ha expirado.' });
      }

      const questionsSnapshot: any[] = attemptData.questions || [];
      let totalPoints = 0;
      let earnedPoints = 0;
      
      const answersMap = new Map<string, string>();
      answers.forEach((ans: any) => {
        answersMap.set(ans.questionId, String(ans.answer).trim());
      });

      const gradedAnswers: any[] = [];
      const feedbackList: any[] = [];

      questionsSnapshot.forEach((q: any) => {
        const questionId = q.id;
        const clientAnswer = answersMap.get(questionId) || '';
        const points = q.points || 1;
        totalPoints += points;
        
        let correct = false;
        let reviewFeedback = q.feedback || '';

        if (q.type === 'multiple_choice') {
          const selectedIndex = parseInt(clientAnswer, 10);
          if (selectedIndex === q.correctOptionIndex) {
            correct = true;
            earnedPoints += points;
          }
        } else if (q.type === 'open_short' || q.type === 'scenario') {
          const cleanedAnswer = cleanText(clientAnswer);
          const keywords: string[] = q.expectedAnswerKeywords || [];
          const matchingKeywords = keywords.filter(kw => cleanedAnswer.includes(cleanText(kw)));
          const matchThreshold = Math.ceil(keywords.length * 0.75);
          if (keywords.length === 0 || matchingKeywords.length >= matchThreshold) {
            correct = true;
            earnedPoints += points;
          } else {
            reviewFeedback = `${reviewFeedback} (Para una respuesta completa, se esperaba incluir términos como: ${keywords.join(', ')}).`;
          }
        }

        gradedAnswers.push({ questionId, answer: clientAnswer, correct, feedback: reviewFeedback });
        feedbackList.push({ questionId, questionText: q.question, correct, clientAnswer, feedback: reviewFeedback });
      });

      const scorePercent = Math.round((earnedPoints / totalPoints) * 100);
      const passed = scorePercent >= 70;
      
      let certificationLevel: string | null = null;
      if (passed) {
        certificationLevel = scorePercent >= 90 ? 'Certificada Método Pame' : 'Em Formação';
      }

      let certificationCode: string | null = null;
      if (passed) {
        const year = new Date().getFullYear();
        const random6 = Math.random().toString(36).substring(2, 8).toUpperCase();
        certificationCode = `MP-CERT-${year}-${employeeId}-${random6}`;
      }

      await attemptRef.update({
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        gradedAt: admin.firestore.FieldValue.serverTimestamp(),
        answers: gradedAnswers,
        scorePercent,
        passed,
        certificationLevel,
        certificationCode
      });

      const empRef = db.collection('employees').doc(employeeId);
      const empDocData = (await empRef.get()).data() || {};
      const pastAttempts = empDocData.finalExamAttempts || [];
      const newAttemptSummary = {
        attemptId,
        startedAt: attemptData.startedAt,
        gradedAt: admin.firestore.FieldValue.serverTimestamp(),
        scorePercent,
        passed,
        certificationLevel
      };

      const updateFields: any = {
        finalExamScore: scorePercent,
        finalExamAttempts: [...pastAttempts, newAttemptSummary],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      if (passed) {
        updateFields.trainingStatus = certificationLevel === 'Certificada Método Pame' ? 'certified' : 'completed';
        updateFields.certificationLevel = certificationLevel;
        updateFields.certificationDate = admin.firestore.FieldValue.serverTimestamp();
        updateFields.certificationCode = certificationCode;
        updateFields.trainingCompletedAt = admin.firestore.FieldValue.serverTimestamp();
      }

      await empRef.update(updateFields);

      if (passed && certificationCode) {
        await db.collection('certifications').doc(certificationCode).set({
          id: certificationCode,
          employeeId,
          employeeName: empDocData.name || 'Especialista Método Pame',
          level: certificationLevel,
          finalExamScorePercent: scorePercent,
          modulesCompleted: 15,
          issuedAt: admin.firestore.FieldValue.serverTimestamp(),
          issuedBy: 'pame',
          certificateCode: certificationCode,
          valid: true,
          revokedAt: null,
          revokedReason: null
        });
      }

      return res.status(200).json({
        scorePercent,
        passed,
        certificationLevel,
        certificationCode,
        feedback: feedbackList
      });

    } else if (action === 'migrate-employees') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
      
      const isAdminUser = userEmail && (
        userEmail === 'metodopame.homedetail@gmail.com' ||
        userEmail === 'contactosaintdac@gmail.com'
      );

      if (!isAdminUser) {
        return res.status(403).json({ error: 'Forbidden: only admins can migrate employees' });
      }

      const report: string[] = [];
      const empSnap = await db.collection('employees').get();
      report.push(`Iniciando migração... Se encontraron ${empSnap.size} documentos.`);

      let migratedCount = 0;
      let skippedCount = 0;

      for (const employeeDoc of empSnap.docs) {
        const employeeId = employeeDoc.id;
        const employeeData = employeeDoc.data();

        if (!employeeData.email) {
          report.push(`[Saltado] Documento ${employeeId} no tiene email.`);
          skippedCount++;
          continue;
        }

        try {
          const userRecord = await auth.getUserByEmail(employeeData.email);
          const authUid = userRecord.uid;

          if (employeeId === authUid) {
            report.push(`[Ok] ${employeeData.name} ya usa su UID.`);
            continue;
          }

          report.push(`[Migrando] ${employeeData.name} (${employeeData.email}): ${employeeId} -> ${authUid}`);

          await db.collection('employees').doc(authUid).set({
            ...employeeData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          const scheduleSnap = await db.collection('employee_schedules').doc(employeeId).collection('blocks').get();
          if (!scheduleSnap.empty) {
            for (const blockDoc of scheduleSnap.docs) {
              await db.collection('employee_schedules').doc(authUid).collection('blocks').doc(blockDoc.id).set(blockDoc.data());
              await db.collection('employee_schedules').doc(employeeId).collection('blocks').doc(blockDoc.id).delete();
            }
          }

          const bookingsSnap = await db.collectionGroup('bookings').where('assignedEmployeeId', '==', employeeId).get();
          if (!bookingsSnap.empty) {
            for (const bookingDoc of bookingsSnap.docs) {
              await bookingDoc.ref.update({ assignedEmployeeId: authUid });
            }
          }

          await db.collection('employees').doc(employeeId).delete();
          migratedCount++;

        } catch (err: any) {
          if (err.code === 'auth/user-not-found') {
            report.push(`[Saltado] No existe Auth para ${employeeData.email}.`);
            skippedCount++;
          } else {
            throw err;
          }
        }
      }

      return res.status(200).json({
        success: true,
        report,
        summary: { total: empSnap.size, migrated: migratedCount, skipped: skippedCount }
      });
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error: any) {
    console.error(`[LMS API] Error:`, error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
