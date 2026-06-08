import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { clientName, date, shift, totalPrice, employeeName, addons } = req.body;

  const htmlContent = `
    <div style="background-color: #fff7fd; padding: 40px 20px; font-family: 'Manrope', 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e1a20;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #f8f7f9; border-radius: 12px; overflow: hidden; box-shadow: -4px -4px 12px rgba(255,255,255,0.8), 4px 4px 12px rgba(226,217,230,1);">
        
        <div style="padding: 40px 40px 30px 40px; text-align: center; border-bottom: 1px solid #efe5ee;">
          <h1 style="margin: 0; font-family: 'Manrope', sans-serif; font-size: 24px; font-weight: 800; color: #561668; letter-spacing: 2px; text-transform: uppercase;">MÉTODO PAME</h1>
          <div style="height: 2px; width: 40px; background-color: #703081; margin: 16px auto 0 auto;"></div>
        </div>
        
        <div style="padding: 40px;">
          <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 700; color: #1e1a20;">Nova Reserva Exclusiva</h2>
          <p style="margin: 0 0 30px 0; font-size: 16px; line-height: 1.6; color: #4e434e;">
            Um novo agendamento foi confirmado no sistema. Abaixo estão os detalhes para o seu controle.
          </p>
          
          <div style="background-color: #f4ebf4; border-radius: 8px; padding: 30px; box-shadow: inset 2px 2px 6px rgba(226,217,230,0.6), inset -2px -2px 6px rgba(255,255,255,0.8);">
            <h3 style="margin: 0 0 20px 0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #80737f;">Dados do Cliente e Serviço</h3>
            
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px; color: #1e1a20; line-height: 2.2;">
              <tr>
                <td style="color: #80737f; padding-right: 20px; width: 120px;">Cliente:</td>
                <td style="font-weight: 600;">${clientName}</td>
              </tr>
              <tr>
                <td style="color: #80737f; padding-right: 20px;">Data:</td>
                <td style="font-weight: 600;">${date}</td>
              </tr>
              <tr>
                <td style="color: #80737f; padding-right: 20px;">Turno:</td>
                <td style="font-weight: 600;">${shift}</td>
              </tr>
              <tr>
                <td style="color: #80737f; padding-right: 20px;">Faturamento:</td>
                <td style="font-weight: 700; color: #703081;">R$ ${totalPrice}</td>
              </tr>
              <tr>
                <td style="color: #80737f; padding-right: 20px;">Especialista:</td>
                <td style="font-weight: 600;">${employeeName}</td>
              </tr>
              ${addons && addons.length > 0 ? \`
              <tr>
                <td style="color: #80737f; padding-right: 20px;" valign="top">Adicionais:</td>
                <td style="font-weight: 600; line-height: 1.4; padding-top: 4px;">\${addons.join('<br>')}</td>
              </tr>\` : ''}
            </table>
          </div>
        </div>
        
        <div style="background-color: #561668; padding: 30px 40px; text-align: center;">
          <p style="margin: 0; font-size: 12px; font-weight: 600; color: #fcd7ff; letter-spacing: 1px; text-transform: uppercase;">Sistema de Gestão Interna | MÉTODO PAME</p>
        </div>

      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Método Pame <reservas@metodopame.com>',
      to: [process.env.ADMIN_EMAIL || 'admin@metodopame.com'],
      subject: `Nova Reserva: ${clientName} - MÉTODO PAME`,
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
