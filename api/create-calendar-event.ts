import { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const PAME_EMAIL = 'metodopame.homedetail@gmail.com';
const DEV_EMAIL = 'contactosaintdac@gmail.com';

function generateJWT(clientEmail: string, privateKey: string, scope: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: scope,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  })).toString('base64url');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, 'base64url');

  return `${header}.${payload}.${signature}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { type, details } = req.body;

  // Check if credentials are present
  const serviceAccountKeyStr = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;

  if (!serviceAccountKeyStr || !calendarId) {
    console.warn('⚠️ Google Calendar environment variables are missing. Simulating event creation.');
    
    if (type === 'cafe-virtual') {
      try {
        const { candidateName, date, time, whatsapp } = details;
        const subject = `⚠️ [Aviso] Café Virtual Agendado (Sem Sincronização) — ${candidateName}`;
        const html = `
          <div style="background:#fff7fd;padding:32px;font-family:Manrope,Helvetica,Arial,sans-serif;color:#1e1a20;border:1px solid #efe5ee;border-radius:16px;max-width:600px;margin:0 auto;">
            <h1 style="color:#561668;font-size:24px;border-bottom:1px solid #efe5ee;padding-bottom:16px;">MÉTODO PAME</h1>
            <p style="font-size:16px;font-weight:bold;color:#703081;">Atenção Pame,</p>
            <p style="font-size:14px;line-height:1.6;">A candidata <strong>${candidateName}</strong> acabou de agendar um <strong>Café Virtual</strong>.</p>
            
            <div style="background:#faf1fa;padding:20px;border-radius:12px;margin:20px 0;border-left:4px solid #561668;">
              <p style="margin:0;font-size:13px;color:#80737f;text-transform:uppercase;font-weight:bold;letter-spacing:1px;">Detalhes do Agendamento</p>
              <p style="margin:8px 0 0 0;font-size:14px;color:#1e1a20;"><strong>Data:</strong> ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style="margin:4px 0 0 0;font-size:14px;color:#1e1a20;"><strong>Horário:</strong> ${time}h</p>
              <p style="margin:4px 0 0 0;font-size:14px;color:#1e1a20;"><strong>WhatsApp de contato:</strong> ${whatsapp}</p>
            </div>

            <div style="background:#fff3cd;border:1px solid #ffeeba;color:#856404;padding:15px;border-radius:12px;font-size:13px;line-height:1.5;">
              <strong>⚠️ IMPORTANTE:</strong> As variáveis de ambiente do Google Calendar não estão configuradas no servidor de produção. 
              <strong>Este evento NÃO foi criado na sua agenda automática.</strong> Por favor, adicione-o manualmente no seu calendário para não esquecer.
            </div>
            
            <p style="font-size:11px;color:#80737f;margin-top:24px;text-align:center;text-transform:uppercase;font-weight:bold;letter-spacing:1px;">Método Pame · Recrutamento</p>
          </div>
        `;
        
        await resend.emails.send({
          from: 'Método Pame <reservas@metodopame.com>',
          to: [PAME_EMAIL],
          cc: [DEV_EMAIL],
          subject: subject,
          html: html
        });
        console.log(`Email de alerta (Missing env) enviado para ${PAME_EMAIL}`);
      } catch (emailErr) {
        console.error('Falha ao enviar email de alerta por falta de env:', emailErr);
      }
    }

    return res.status(200).json({
      mock: true,
      message: 'Event simulated because GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_CALENDAR_ID is not configured.',
    });
  }

  try {
    const keyData = JSON.parse(serviceAccountKeyStr);
    const privateKey = keyData.private_key.replace(/\\n/g, '\n');
    const clientEmail = keyData.client_email;

    // 1. Generate JWT assertion and get OAuth2 access token
    const jwt = generateJWT(clientEmail, privateKey, 'https://www.googleapis.com/auth/calendar.events');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenRes.ok) {
      const tokenErr = await tokenRes.text();
      console.error('Google token authentication error:', tokenErr);
      throw new Error(`Google token error: ${tokenErr}`);
    }

    const { access_token } = await tokenRes.json();

    // 2. Prepare event payload
    let summary = '';
    let description = '';
    let startDateTime = '';
    let endDateTime = '';

    if (type === 'cafe-virtual') {
      const { candidateName, date, time, whatsapp } = details;
      summary = `Café Virtual com a Pame — ${candidateName}`;
      description = `Café Virtual com a candidata de equipe.\nWhatsApp: ${whatsapp}\n\nAgendamento automático via Módulo Pame.`;
      
      // time format is e.g. "10:00"
      // date format is e.g. "2026-06-11"
      startDateTime = `${date}T${time}:00`;
      
      // Calculate end time (assuming 30 minutes for Cafe Virtual)
      const [hours, minutes] = time.split(':').map(Number);
      let endMins = minutes + 30;
      let endHrs = hours;
      if (endMins >= 60) {
        endMins -= 60;
        endHrs += 1;
      }
      const endHrsStr = endHrs.toString().padStart(2, '0');
      const endMinsStr = endMins.toString().padStart(2, '0');
      endDateTime = `${date}T${endHrsStr}:${endMinsStr}:00`;

    } else {
      // Client Booking Event
      const { clientName, date, shift, modality, addons, totalValue, employeeName } = details;
      summary = `Faxina MÉTODO PAME — ${clientName}`;
      description = `Turno: ${shift}\nModalidade: ${modality}\nEspecialista: ${employeeName || 'A designar'}\nAdd-ons: ${addons && addons.length > 0 ? addons.join(', ') : 'Nenhum'}\nValor: R$ ${totalValue}`;
      
      // date is ISO string or YYYY-MM-DD
      const dateOnly = date.split('T')[0];
      if (shift.toLowerCase().includes('tarde')) {
        startDateTime = `${dateOnly}T14:00:00`;
        endDateTime = `${dateOnly}T18:00:00`;
      } else if (shift.toLowerCase().includes('completo')) {
        startDateTime = `${dateOnly}T08:00:00`;
        endDateTime = `${dateOnly}T17:00:00`;
      } else {
        // Manhã
        startDateTime = `${dateOnly}T08:00:00`;
        endDateTime = `${dateOnly}T12:00:00`;
      }
    }

    const eventBody = {
      summary,
      description,
      location: 'Tijucas, SC, Brasil',
      start: {
        dateTime: startDateTime,
        timeZone: 'America/Sao_Paulo',
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'America/Sao_Paulo',
      },
    };

    // 3. Create the event in the calendar
    const eventUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
    const eventRes = await fetch(eventUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(eventBody),
    });

    if (!eventRes.ok) {
      const eventErr = await eventRes.text();
      console.error('Google Calendar event creation error:', eventErr);
      throw new Error(`Google Calendar error: ${eventErr}`);
    }

    const eventData = await eventRes.json();
    return res.status(200).json({ success: true, event: eventData });

  } catch (err: any) {
    console.error('Calendar Integration Failure:', err);
    
    if (type === 'cafe-virtual') {
      console.warn('⚠️ Google Calendar sync failed for Café Virtual. Falling back to simulation.');
      try {
        const { candidateName, date, time, whatsapp } = details;
        const subject = `⚠️ [Aviso] Café Virtual Agendado (Sem Sincronização) — ${candidateName}`;
        const html = `
          <div style="background:#fff7fd;padding:32px;font-family:Manrope,Helvetica,Arial,sans-serif;color:#1e1a20;border:1px solid #efe5ee;border-radius:16px;max-width:600px;margin:0 auto;">
            <h1 style="color:#561668;font-size:24px;border-bottom:1px solid #efe5ee;padding-bottom:16px;">MÉTODO PAME</h1>
            <p style="font-size:16px;font-weight:bold;color:#703081;">Atenção Pame,</p>
            <p style="font-size:14px;line-height:1.6;">A candidata <strong>${candidateName}</strong> acabou de agendar um <strong>Café Virtual</strong>.</p>
            
            <div style="background:#faf1fa;padding:20px;border-radius:12px;margin:20px 0;border-left:4px solid #561668;">
              <p style="margin:0;font-size:13px;color:#80737f;text-transform:uppercase;font-weight:bold;letter-spacing:1px;">Detalhes do Agendamento</p>
              <p style="margin:8px 0 0 0;font-size:14px;color:#1e1a20;"><strong>Data:</strong> ${new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p style="margin:4px 0 0 0;font-size:14px;color:#1e1a20;"><strong>Horário:</strong> ${time}h</p>
              <p style="margin:4px 0 0 0;font-size:14px;color:#1e1a20;"><strong>WhatsApp de contato:</strong> ${whatsapp}</p>
            </div>

            <div style="background:#fff3cd;border:1px solid #ffeeba;color:#856404;padding:15px;border-radius:12px;font-size:13px;line-height:1.5;">
              <strong>⚠️ IMPORTANTE:</strong> A sincronização automática com o seu Google Calendar falhou (Erro: ${err.message}). 
              <strong>Este evento NÃO foi criado na sua agenda automática.</strong> Por favor, adicione-o manualmente no seu calendário para não esquecer.
            </div>
            
            <p style="font-size:11px;color:#80737f;margin-top:24px;text-align:center;text-transform:uppercase;font-weight:bold;letter-spacing:1px;">Método Pame · Recrutamento</p>
          </div>
        `;
        
        await resend.emails.send({
          from: 'Método Pame <reservas@metodopame.com>',
          to: [PAME_EMAIL],
          cc: [DEV_EMAIL],
          subject: subject,
          html: html
        });
        console.log(`Email de alerta (Catch fail) enviado para ${PAME_EMAIL}`);
      } catch (emailErr) {
        console.error('Falha ao enviar email de alerta por Resend (catch):', emailErr);
      }

      return res.status(200).json({ 
        success: true, 
        mock: true, 
        message: 'Google Calendar sync failed, fallback simulation triggered.',
        event: {
          summary: `Café Virtual com a Pame — ${details.candidateName}`,
          description: `Café Virtual com a candidata de equipe.\nWhatsApp: ${details.whatsapp}\n\nAgendamento automático via Módulo Pame.`,
          start: { dateTime: `${details.date}T${details.time}:00` }
        }
      });
    }

    return res.status(500).json({ error: 'Failed to create calendar event', details: err.message });
  }
}
