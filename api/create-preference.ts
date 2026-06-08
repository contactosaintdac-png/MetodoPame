import { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Preference } from 'mercadopago';

// Instanciar el SDK solo si tenemos el token
const accessToken = process.env.MP_ACCESS_TOKEN || '';
const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!accessToken) {
    console.error("FATAL: MP_ACCESS_TOKEN no configurado en las variables de entorno");
    return res.status(500).json({ error: 'Missing Mercado Pago credentials in backend' });
  }

  try {
    const payload = req.body;
    
    // Validación de seguridad básica del payload
    if (!payload.title || !payload.totalValue || !payload.clientName) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }

    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: 'LIMPEZA_PAME',
            title: payload.title,
            unit_price: Number(payload.totalValue),
            quantity: 1,
            currency_id: 'BRL',
          }
        ],
        payer: {
          name: payload.clientName,
          email: payload.clientEmail || 'cliente@exemplo.com',
        },
        back_urls: {
          success: `${req.headers.origin || 'https://metodopame.com'}/`,
          failure: `${req.headers.origin || 'https://metodopame.com'}/`,
          pending: `${req.headers.origin || 'https://metodopame.com'}/`
        },
        auto_return: 'approved',
        payment_methods: {
          excluded_payment_types: [
            { id: "ticket" } // Excluir boletos si se desea que sea inmediato, opcional.
          ],
          installments: 6
        },
        statement_descriptor: 'METODO PAME',
        external_reference: `${Date.now()}`
      }
    });

    console.log("Preferencia creada exitosamente:", result.id);
    
    // Return both init_point (prod) and sandbox_init_point (test)
    return res.status(200).json({
      id: result.id,
      init_point: result.init_point,
      sandbox_init_point: result.sandbox_init_point
    });

  } catch (error: any) {
    console.error("Error al crear preferencia de Mercado Pago:", error);
    return res.status(500).json({ 
      error: 'Error interno al comunicarse con Mercado Pago',
      details: error.message 
    });
  }
}
