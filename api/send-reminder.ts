import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import * as admin from 'firebase-admin';

const resend = new Resend(process.env.RESEND_API_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verificamos o cron job auth header do Vercel para segurança (opcional mas recomendado)
  if (req.headers.authorization !== \`Bearer \${process.env.CRON_SECRET}\` && !process.env.IS_DEV) {
    console.warn("Cron Authorization failed or missing");
  }

  // Calculamos la fecha de mañana
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDateStr = tomorrow.toISOString().split('T')[0];

  try {
    const bookingsSnapshot = await db.collectionGroup('bookings').where('date', '==', targetDateStr).get();
    
    if (bookingsSnapshot.empty) {
      return res.status(200).json({ message: 'No bookings found for tomorrow.' });
    }

    const emailsToSend = [];

    for (const doc of bookingsSnapshot.docs) {
      const data = doc.data();
      const parentUserRef = doc.ref.parent.parent;
      if (!parentUserRef) continue;

      const userDoc = await parentUserRef.get();
      if (!userDoc.exists) continue;
      
      const userData = userDoc.data();
      const clientEmail = userData?.email; // Assumindo que guardamos o email do cliente no doc do user

      if (clientEmail && data.assignedEmployeeName) {
        // Encontra o perfil do cliente para pegar o endereço
        const triageDoc = await parentUserRef.collection('profile').doc('triage').get();
        const address = triageDoc.exists ? \`\${triageDoc.data()?.city}, \${triageDoc.data()?.neighborhood}\` : 'Endereço cadastrado';

        const htmlContent = \`
          <div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #1e1a20; padding: 40px; max-width: 600px; margin: 0 auto; border: 1px solid #efe5ee; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #561668; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 2px;">MÉTODO PAME</h1>
            </div>
            <h2 style="font-size: 18px; font-weight: bold; color: #561668; margin-bottom: 16px;">Lembrete de Serviço</h2>
            <p style="font-size: 15px; line-height: 1.6; color: #4e434e; margin-bottom: 24px;">
              Sua especialista chega amanhã! Aqui estão os detalhes do seu serviço:
            </p>
            
            <div style="background-color: #faf1fa; border: 1px solid #efe5ee; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Data:</strong> \${data.date}</p>
              <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Horário:</strong> \${data.time || '09:00'}</p>
              <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Especialista:</strong> \${data.assignedEmployeeName}</p>
              <p style="margin: 0 0 0 0; font-size: 14px;"><strong>Endereço:</strong> \${address}</p>
            </div>

            <hr style="border: none; border-top: 1px solid #efe5ee; margin: 40px 0 20px 0;" />
            <p style="text-align: center; font-size: 12px; color: #80737f; margin: 0;">Equipe Método Pame</p>
          </div>
        \`;

        emailsToSend.push(resend.emails.send({
          from: 'Método Pame <no-reply@metodopame.com.br>',
          to: [clientEmail],
          subject: 'Sua especialista chega amanhã — MÉTODO PAME',
          html: htmlContent,
        }));
      }
    }

    await Promise.all(emailsToSend);
    res.status(200).json({ message: \`Sent \${emailsToSend.length} reminder emails.\` });

  } catch (error) {
    console.error("Error sending reminders:", error);
    res.status(500).json({ error: String(error) });
  }
}
