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

/**
 * Cron job: Reveal client address to the assigned specialist 24h before the booking.
 * 
 * Runs every 6 hours. Looks for bookings dated tomorrow that:
 *  1. Have an assigned specialist (assignedEmployeeId)
 *  2. Haven't had the address revealed yet (!addressRevealedAt)
 *  3. Have an address to reveal
 * 
 * Sends the full address via email (Resend) and WhatsApp (Meta Cloud API),
 * then marks the booking with `addressRevealedAt` to prevent duplicates.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Optional: Verify Vercel cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}` && !process.env.IS_DEV) {
    console.warn('[address-reveal] Cron Authorization header missing or invalid (non-blocking).');
  }

  // Calculate tomorrow's date string (YYYY-MM-DD)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  try {
    // Find all bookings for tomorrow with an assigned specialist
    const snapshot = await db.collectionGroup('bookings')
      .where('date', '==', tomorrowStr)
      .where('status', '==', 'Confirmado')
      .get();

    if (snapshot.empty) {
      return res.status(200).json({ message: 'No bookings for tomorrow.', sent: 0 });
    }

    let sentCount = 0;
    const errors: string[] = [];

    for (const bookingDoc of snapshot.docs) {
      const booking = bookingDoc.data();

      // Skip if no specialist assigned
      if (!booking.assignedEmployeeId) continue;
      // Skip if address already revealed
      if (booking.addressRevealedAt) continue;
      // Skip if no address to reveal
      if (!booking.address || booking.address === 'Endereço liberado 24h antes do atendimento') continue;

      // Fetch specialist data
      let empName = 'Especialista';
      let empEmail = '';
      let empWhatsapp = '';
      try {
        const empDoc = await db.collection('employees').doc(booking.assignedEmployeeId).get();
        if (empDoc.exists) {
          const empData = empDoc.data();
          empName = empData?.name || empName;
          empEmail = empData?.email || '';
          empWhatsapp = empData?.whatsapp || '';
        }
      } catch (err) {
        console.error(`[address-reveal] Error fetching employee ${booking.assignedEmployeeId}:`, err);
      }

      const clientAddress = booking.address;
      const shiftLabel = booking.format === 'meio' ? 'Meio Turno' : 'Turno Completo';

      // 1. Send email with revealed address
      if (empEmail) {
        try {
          const htmlContent = `
            <div style="background-color: #fff7fd; padding: 40px 20px; font-family: 'Manrope', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e1a20;">
              <div style="max-width: 600px; margin: 0 auto; background-color: #f8f7f9; border-radius: 12px; overflow: hidden; box-shadow: -4px -4px 12px rgba(255,255,255,0.8), 4px 4px 12px rgba(226,217,230,1);">
                
                <div style="padding: 40px 40px 30px 40px; text-align: center; border-bottom: 1px solid #efe5ee;">
                  <h1 style="margin: 0; font-family: 'Manrope', sans-serif; font-size: 24px; font-weight: 800; color: #561668; letter-spacing: 2px; text-transform: uppercase;">MÉTODO PAME</h1>
                  <div style="height: 2px; width: 40px; background-color: #703081; margin: 16px auto 0 auto;"></div>
                </div>
                
                <div style="padding: 40px;">
                  <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #1e1a20;">📍 Endereço Liberado</h2>
                  <p style="margin: 0 0 10px 0; font-size: 16px; line-height: 1.6; color: #4e434e;">
                    Olá, ${empName}. O endereço do seu serviço de amanhã foi liberado:
                  </p>
                  
                  <div style="background-color: #f4ebf4; border-radius: 8px; padding: 30px; margin: 20px 0; box-shadow: inset 2px 2px 6px rgba(226,217,230,0.6), inset -2px -2px 6px rgba(255,255,255,0.8);">
                    <h3 style="margin: 0 0 20px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #80737f;">Detalhes do Atendimento</h3>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #1e1a20; line-height: 2.2;">
                      <tr>
                        <td style="color: #80737f; padding-right: 20px; width: 100px;">Data:</td>
                        <td style="font-weight: 600;">${tomorrowStr}</td>
                      </tr>
                      <tr>
                        <td style="color: #80737f; padding-right: 20px;">Turno:</td>
                        <td style="font-weight: 600;">${shiftLabel}</td>
                      </tr>
                      <tr>
                        <td style="color: #80737f; padding-right: 20px;">Cliente:</td>
                        <td style="font-weight: 600;">${booking.name || 'Cliente'}</td>
                      </tr>
                      <tr>
                        <td style="color: #80737f; padding-right: 20px;" valign="top">Endereço:</td>
                        <td style="font-weight: 600; line-height: 1.4; padding-top: 4px; color: #561668;">${clientAddress}</td>
                      </tr>
                    </table>
                  </div>

                  <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 1.5; color: #80737f;">
                    Por favor, planeje sua rota com antecedência. Lembre-se de chegar com pelo menos 10 minutos de antecedência.
                  </p>
                </div>
                
                <div style="background-color: #561668; padding: 30px 40px; text-align: center;">
                  <p style="margin: 0; font-size: 12px; font-weight: 600; color: #fcd7ff; letter-spacing: 1px; text-transform: uppercase;">Padrão de Qualidade Método Pame</p>
                </div>

              </div>
            </div>
          `;

          await resend.emails.send({
            from: 'Método Pame <reservas@metodopame.com>',
            to: [empEmail],
            subject: `📍 Endereço Liberado — Serviço de Amanhã (${tomorrowStr})`,
            html: htmlContent,
          });
          console.log(`[address-reveal] Email sent to ${empEmail} for booking ${bookingDoc.id}`);
        } catch (err) {
          console.error(`[address-reveal] Email error for ${empEmail}:`, err);
          errors.push(`Email to ${empEmail}: ${String(err)}`);
        }
      }

      // 2. Send WhatsApp with revealed address
      const phoneId = process.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
      const token = process.env.VITE_WHATSAPP_ACCESS_TOKEN;

      if (empWhatsapp && phoneId && token) {
        let cleanPhone = empWhatsapp.replace(/\D/g, '');
        if (cleanPhone.length > 0 && !cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
          cleanPhone = '55' + cleanPhone;
        }

        try {
          const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: cleanPhone,
            type: 'template',
            template: {
              name: 'endereco_liberado',
              language: { code: 'pt_BR' },
              components: [{
                type: 'body',
                parameters: [
                  { type: 'text', text: empName },
                  { type: 'text', text: tomorrowStr },
                  { type: 'text', text: shiftLabel },
                  { type: 'text', text: clientAddress },
                ].map(p => ({ type: 'text', text: String(p.text) }))
              }]
            }
          };

          const response = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          if (!response.ok) {
            console.error(`[address-reveal] WhatsApp error for ${cleanPhone}:`, JSON.stringify(data));
            errors.push(`WhatsApp to ${cleanPhone}: ${JSON.stringify(data.error || data)}`);
          } else {
            console.log(`[address-reveal] WhatsApp sent to ${cleanPhone} for booking ${bookingDoc.id}`);
          }
        } catch (err) {
          console.error(`[address-reveal] WhatsApp error:`, err);
          errors.push(`WhatsApp to ${cleanPhone}: ${String(err)}`);
        }
      }

      // 3. Mark booking as address-revealed to prevent duplicate sends
      try {
        await bookingDoc.ref.update({
          addressRevealedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.error(`[address-reveal] Error marking booking ${bookingDoc.id}:`, err);
      }

      sentCount++;
    }

    return res.status(200).json({
      message: `Address reveal complete. Processed ${sentCount} booking(s).`,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error) {
    console.error('[address-reveal] Critical error:', error);
    return res.status(500).json({ error: String(error) });
  }
}
