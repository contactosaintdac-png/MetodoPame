import { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Preference } from 'mercadopago';

// Instanciar el SDK solo si tenemos el token
const accessToken = process.env.MP_ACCESS_TOKEN || '';
const client = new MercadoPagoConfig({ accessToken, options: { timeout: 5000 } });

interface TriageData {
  rooms: number;
  baths: number;
  floors: number;
  marble: boolean;
  wood: boolean;
  doubleGlass: boolean;
  chandeliers: boolean;
}

// Calculate the service price securely on the server
function calculateServerPrice(
  format: 'meio' | 'completo',
  mode: 'avulso' | 'mensal',
  triageData: TriageData,
  activeAddons: string[]
): number {
  const isMensal = mode === 'mensal';
  const sessions = isMensal ? 4 : 1;
  const baseSession = format === 'meio' ? 350 : 450;
  
  // Base house is 3 rooms, 2 baths, 1 floor
  const extraRooms = Math.max(0, Number(triageData.rooms) - 3);
  const extraBaths = Math.max(0, Number(triageData.baths) - 2);
  const extraFloors = Math.max(0, Number(triageData.floors) - 1);
  const sizeFeePerSession = (extraRooms * 50) + (extraBaths * 30) + (extraFloors * 80);
  
  // Surface count for premium care
  const surfaceCount = [
    triageData.marble,
    triageData.wood,
    triageData.doubleGlass,
    triageData.chandeliers,
  ].filter(Boolean).length;

  const luxuryCareFeePerSession = surfaceCount * 30;
  const addonsPricePerSession = (activeAddons || []).length * 50;

  const perSession = baseSession + sizeFeePerSession + luxuryCareFeePerSession + addonsPricePerSession;
  let total = perSession * sessions;
  
  if (isMensal) {
     const discount = format === 'meio' ? 200 : 300;
     total -= discount;
  }
  
  return total;
}

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
    const { format, mode, triageData, activeAddons, clientName, clientEmail } = req.body;
    
    // Safe validation of required fields
    if (!format || !mode || !triageData || !clientName) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos de cálculo' });
    }

    // Calculate price securely on the server
    const calculatedPrice = calculateServerPrice(format, mode, triageData, activeAddons);
    const title = `Limpeza Método Pame - ${format === 'meio' ? 'Meio Turno' : 'Turno Completo'} (${mode === 'mensal' ? 'Mensal' : 'Avulso'})`;

    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          {
            id: 'LIMPEZA_PAME',
            title: title,
            unit_price: calculatedPrice,
            quantity: 1,
            currency_id: 'BRL',
          }
        ],
        payer: {
          name: clientName,
          email: clientEmail || 'cliente@exemplo.com',
        },
        back_urls: {
          success: `${req.headers.origin || 'https://metodopame.com'}/`,
          failure: `${req.headers.origin || 'https://metodopame.com'}/`,
          pending: `${req.headers.origin || 'https://metodopame.com'}/`
        },
        auto_return: 'approved',
        payment_methods: {
          excluded_payment_types: [
            { id: "ticket" } // Excluir boletos para que sea inmediato
          ],
          installments: 6
        },
        statement_descriptor: 'METODO PAME',
        external_reference: `${Date.now()}`
      }
    });

    console.log(`Preferencia creada exitosamente con precio seguro calculado: R$ ${calculatedPrice} (ID: ${result.id})`);
    
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
