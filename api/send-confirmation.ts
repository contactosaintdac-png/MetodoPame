import { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { clientName, clientEmail, date, shift, totalPrice, employeeName, employeePhoto } = req.body;

  if (!clientEmail) {
     return res.status(400).json({ error: 'Email is required' });
  }

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background-color: #ffffff; color: #1e1a20; padding: 40px; max-width: 600px; margin: 0 auto; border: 1px solid #efe5ee; border-radius: 16px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #561668; margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 2px;">MÉTODO PAME</h1>
      </div>
      <h2 style="font-size: 18px; font-weight: bold; color: #561668; margin-bottom: 16px;">Olá, ${clientName}!</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #4e434e; margin-bottom: 24px;">
        Seu agendamento foi confirmado com sucesso. Estamos ansiosos para cuidar do seu lar!
      </p>
      
      <div style="background-color: #faf1fa; border: 1px solid #efe5ee; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
        <h3 style="margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; color: #561668; letter-spacing: 1px;">Resumo do Serviço</h3>
        <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Data:</strong> ${date}</p>
        <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>Turno:</strong> ${shift}</p>
        <p style="margin: 0 0 0 0; font-size: 14px;"><strong>Valor Total:</strong> R$ ${totalPrice}</p>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        <h3 style="margin: 0 0 16px 0; font-size: 14px; text-transform: uppercase; color: #80737f; letter-spacing: 1px;">Sua Especialista</h3>
        ${employeePhoto ? `<img src="${employeePhoto}" alt="${employeeName}" style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #faf1fa; margin-bottom: 12px; object-fit: cover;" />` : ''}
        <p style="margin: 0; font-size: 16px; font-weight: bold; color: #561668;">${employeeName}</p>
      </div>

      <hr style="border: none; border-top: 1px solid #efe5ee; margin: 40px 0 20px 0;" />
      <p style="text-align: center; font-size: 12px; color: #80737f; margin: 0;">© ${new Date().getFullYear()} Método Pame. Todos os direitos reservados.</p>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
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
