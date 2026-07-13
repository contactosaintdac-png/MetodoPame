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

// Helper function to remove Portuguese accents and casing
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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  const { employeeId, attemptId, answers } = req.body; // answers is array of { questionId, answer }

  if (!employeeId || !attemptId || !answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const db = getDb();

    // 1. Verificar token y UID
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    if (uid !== employeeId) {
      return res.status(403).json({ error: 'Forbidden: UID mismatch' });
    }

    // 2. Cargar intento de examen
    const attemptRef = db.collection('employees').doc(employeeId).collection('final_exam_attempts').doc(attemptId);
    const attemptDoc = await attemptRef.get();
    if (!attemptDoc.exists) {
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attemptData = attemptDoc.data();
    if (!attemptData) {
      return res.status(500).json({ error: 'Attempt data is corrupt' });
    }

    if (attemptData.gradedAt !== null) {
      return res.status(400).json({ error: 'Este examen ya ha sido calificado.' });
    }

    // 3. Verificar expiración (límite de 3 horas)
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

    // 4. Corregir examen
    const questionsSnapshot: any[] = attemptData.questions || [];
    let totalPoints = 0;
    let earnedPoints = 0;
    
    // Mapear respuestas enviadas por ID
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
        
        // Verificar si contiene todas las palabras clave
        const matchingKeywords = keywords.filter(kw => cleanedAnswer.includes(cleanText(kw)));
        
        // Criterio de corrección: al menos el 75% de las palabras clave deben estar presentes
        const matchThreshold = Math.ceil(keywords.length * 0.75);
        if (keywords.length === 0 || matchingKeywords.length >= matchThreshold) {
          correct = true;
          earnedPoints += points;
        } else {
          reviewFeedback = `${reviewFeedback} (Para una respuesta completa, se esperaba incluir términos como: ${keywords.join(', ')}).`;
        }
      }

      gradedAnswers.push({
        questionId,
        answer: clientAnswer,
        correct,
        feedback: reviewFeedback
      });

      feedbackList.push({
        questionId,
        questionText: q.question,
        correct,
        clientAnswer,
        feedback: reviewFeedback
      });
    });

    const scorePercent = Math.round((earnedPoints / totalPoints) * 100);
    const passed = scorePercent >= 70;
    
    let certificationLevel: string | null = null;
    if (passed) {
      certificationLevel = scorePercent >= 90 ? 'Certificada Método Pame' : 'Em Formação';
    }

    // 5. Generar código de certificado si aprobó
    let certificationCode: string | null = null;
    if (passed) {
      const year = new Date().getFullYear();
      const random6 = Math.random().toString(36).substring(2, 8).toUpperCase();
      certificationCode = `MP-CERT-${year}-${employeeId}-${random6}`;
    }

    // 6. Actualizar el intento de examen en Firestore (subcolección) con persistencia del feedback
    await attemptRef.update({
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      gradedAt: admin.firestore.FieldValue.serverTimestamp(),
      answers: gradedAnswers, // Guardamos la corrección y feedback aquí
      scorePercent,
      passed,
      certificationLevel,
      certificationCode
    });

    // 7. Actualizar el documento de la empleada en /employees/{id}
    const empRef = db.collection('employees').doc(employeeId);
    const empDocData = (await empRef.get()).data() || {};
    
    // Obtener intentos previos del array para adjuntar el nuevo
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
      updateFields.trainingCompletedAt = admin.firestore.FieldValue.serverTimestamp(); // Se consolida al graduarse
    }

    await empRef.update(updateFields);

    // 8. Crear el registro en la colección pública de certificaciones si aprobó
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

  } catch (error: any) {
    console.error('[grade-final-exam] Catch:', error);
    return res.status(500).json({ error: `Error interno al calificar: ${error.message || error}` });
  }
}
