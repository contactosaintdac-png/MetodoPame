import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { employeeEmail, employeeName, clientAddress, date, shift, addons } = req.body;

  if (!employeeEmail) {
    return res.status(400).json({ error: 'Employee email is required' });
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #1e1a20; padding: 40px; max-width: 600px; margin: 0 auto; border: 1px solid #efe5ee; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #561668; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 2px;">MÉTODO PAME</h1>
      </div>
      <h2 style="font-size: 18px; font-weight: bold; color: #561668; margin-bottom: 16px;">Olá, ${employeeName}!</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #4e434e; margin-bottom: 24px;">
        Você foi alocada para um novo serviço. Por favor, verifique os detalhes abaixo:
      </p>
      
      <div style="background-color: #faf1fa; border: 1px solid #efe5ee; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Data:</strong> ${date}</p>
        <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Turno/Horário:</strong> ${shift}</p>
        <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Endereço:</strong> ${clientAddress}</p>
        ${addons && addons.length > 0 ? `<p style="margin: 0 0 0 0; font-size: 14px;"><strong>Adicionais:</strong> ${addons.join(', ')}</p>` : ''}
      </div>

      <hr style="border: none; border-top: 1px solid #efe5ee; margin: 40px 0 20px 0;" />
      <p style="text-align: center; font-size: 12px; color: #80737f; margin: 0;">Equipe Método Pame</p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Método Pame <reservas@metodopame.com>',
      to: [employeeEmail],
      subject: `Novo Serviço Alocado (${date}) — MÉTODO PAME`,
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
