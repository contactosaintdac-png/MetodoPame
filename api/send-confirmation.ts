import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import admin from 'firebase-admin';

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
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { clientName, clientEmail, date, shift, totalPrice, employeeId } = req.body;
  let { employeeName, employeePhoto } = req.body;

  if (!clientEmail) {
     return res.status(400).json({ error: 'Email is required' });
  }

  // Fetch employee name and photo from Firestore if employeeId is provided
  if (employeeId) {
    try {
      const empDoc = await db.collection('employees').doc(employeeId).get();
      if (empDoc.exists) {
        const empData = empDoc.data();
        if (empData) {
          employeeName = employeeName || empData.name || '';
          employeePhoto = employeePhoto || empData.photoURL || '';
        }
      }
    } catch (err) {
      console.error('[send-confirmation] Error fetching employee details:', err);
    }
  }

  const htmlContent = `
    <div style="background-color: #fff7fd; padding: 40px 20px; font-family: 'Manrope', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e1a20;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #f8f7f9; border-radius: 12px; overflow: hidden; box-shadow: -4px -4px 12px rgba(255,255,255,0.8), 4px 4px 12px rgba(226,217,230,1);">
        
        <!-- Header -->
        <div style="padding: 40px 40px 30px 40px; text-align: center; border-bottom: 1px solid #efe5ee;">
          <h1 style="margin: 0; font-family: 'Manrope', sans-serif; font-size: 24px; font-weight: 800; color: #561668; letter-spacing: 2px; text-transform: uppercase;">MÉTODO PAME</h1>
          <div style="height: 2px; width: 40px; background-color: #703081; margin: 16px auto 0 auto;"></div>
        </div>
        
        <!-- Body -->
        <div style="padding: 40px;">
          <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #1e1a20;">Olá, ${clientName}.</h2>
          <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #4e434e;">
            Sua reserva está confirmada. Preparamos tudo com precisão e cuidado para garantir o mais alto padrão de detalhe para o seu lar.
          </p>
          
          <!-- Details Box (Inset Hollow) -->
          <div style="background-color: #f4ebf4; border-radius: 8px; padding: 30px; margin-bottom: 30px; box-shadow: inset 2px 2px 6px rgba(226,217,230,0.6), inset -2px -2px 6px rgba(255,255,255,0.8);">
            <h3 style="margin: 0 0 20px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #80737f;">Detalhes da Reserva</h3>
            
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #1e1a20; line-height: 2.2;">
              <tr>
                <td style="color: #80737f; padding-right: 20px; width: 100px;">Data:</td>
                <td style="font-weight: 600;">${date}</td>
              </tr>
              <tr>
                <td style="color: #80737f; padding-right: 20px;">Turno:</td>
                <td style="font-weight: 600;">${shift}</td>
              </tr>
              <tr>
                <td style="color: #80737f; padding-right: 20px;">Investimento:</td>
                <td style="font-weight: 700; color: #703081;">R$ ${totalPrice}</td>
              </tr>
            </table>
          </div>

          <!-- Specialist -->
          <div style="text-align: center; margin-top: 40px;">
            <h3 style="margin: 0 0 20px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #80737f;">Especialista Designada</h3>
            ${employeePhoto ? `<img src="${employeePhoto}" alt="${employeeName}" style="width: 72px; height: 72px; border-radius: 50%; border: 2px solid #fff7fd; box-shadow: 0 4px 10px rgba(112,48,129,0.15); margin-bottom: 16px; object-fit: cover;" />` : ''}
            <p style="margin: 0; font-size: 18px; font-weight: 600; color: #1e1a20;">${employeeName}</p>
          </div>

        </div>
        
        <!-- Footer -->
        <div style="background-color: #561668; padding: 30px 40px; text-align: center;">
          <p style="margin: 0; font-size: 12px; font-weight: 600; color: #fcd7ff; letter-spacing: 1px; text-transform: uppercase;">MÉTODO PAME | High-End Home Detail</p>
          <p style="margin: 10px 0 0 0; font-size: 11px; color: #c2bac6;">© ${new Date().getFullYear()} Método Pame. Todos os direitos reservados.</p>
        </div>

      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Método Pame <reservas@metodopame.com>',
      to: [clientEmail],
      subject: 'Seu agendamento foi confirmado — MÉTODO PAME',
      html: htmlContent,
    });

    if (error) {
      console.error(JSON.stringify(error));
      return res.status(400).json({ error });
    }

    res.status(200).json(data);
  } catch (err) {
    console.error('Unexpected Server Error:', err);
    res.status(500).json({ error: err });
  }
}
