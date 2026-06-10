import { VercelRequest, VercelResponse } from '@vercel/node';
import {
  buscarReserva,
  verificarDisponibilidad,
  cambiarFechaReserva,
  cancelarReserva,
  obtenerReserva,
  crearReserva
} from './concierge-actions';

// ─── System Prompt ─────────────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `Eres el Concierge exclusivo del Método Pame, un servicio élite de curaduría del hogar y limpieza profunda de lujo con sede en Brasil.

ROL Y CAPACIDADES:
Tenés acceso a herramientas reales para gestionar reservas. Podés buscar, reagendar, cancelar y crear reservas directamente en el sistema — sin intermediarios.

CÓMO ACTUAR:
- Cuando un cliente quiera cambiar su reserva: primero buscá la reserva por nombre, luego verificá disponibilidad en la nueva fecha, luego ejecutá el cambio.
- Cuando un cliente quiera cancelar: buscá la reserva, confirmá verbalmente con el cliente "¿Confirma la cancelación?", esperá su respuesta, y recién entonces cancelá.
- Cuando un cliente quiera una reserva nueva: recopilá nombre, email, fecha, hora y formato (medio turno 4hs o turno completo 9hs), luego creá la reserva como "Pendiente de Pago".
- Cuando uses una herramienta, actuá con naturalidad — nunca menciones términos técnicos como "voy a llamar a una función" ni "ejecutando herramienta".

TONO Y ESTILO:
- Extremadamente cordial, cálido, de lujo. Primera persona plural ("nuestro equipo").
- Respuestas MUY breves: máximo 2-3 líneas. Conciso, elegante, sin rodeos.
- Siempre confirmá las acciones ejecutadas con los datos reales devueltos por el sistema.

LÍMITES:
- NO hables de precios directamente (el sistema los maneja).
- Si no encontrás la reserva, pedí amablemente que el cliente verifique su nombre.
- Ante cualquier error técnico, indicá que el equipo lo contactará a la brevedad.`;

// ─── Declaración de Tools para Gemini ─────────────────────────────────────────

const TOOL_DECLARATIONS = {
  functionDeclarations: [
    {
      name: 'buscar_reserva',
      description: 'Busca una reserva activa en el sistema por el nombre del cliente. Usar antes de cualquier otra acción.',
      parameters: {
        type: 'object',
        properties: {
          nombre: {
            type: 'string',
            description: 'Nombre completo o parcial del cliente tal como fue proporcionado.'
          }
        },
        required: ['nombre']
      }
    },
    {
      name: 'verificar_disponibilidad',
      description: 'Verifica si una fecha (y opcionalmente hora) está disponible para agendar un servicio.',
      parameters: {
        type: 'object',
        properties: {
          fecha: {
            type: 'string',
            description: 'Fecha en formato YYYY-MM-DD (ej: 2026-06-28)'
          },
          hora: {
            type: 'string',
            description: 'Hora en formato HH:MM (ej: 09:00). Opcional.'
          }
        },
        required: ['fecha']
      }
    },
    {
      name: 'cambiar_fecha_reserva',
      description: 'Cambia la fecha (y opcionalmente la hora) de una reserva existente. Requiere bookingId y uid del cliente.',
      parameters: {
        type: 'object',
        properties: {
          booking_id: {
            type: 'string',
            description: 'ID del documento de la reserva en Firestore.'
          },
          uid: {
            type: 'string',
            description: 'UID del cliente en Firebase.'
          },
          nueva_fecha: {
            type: 'string',
            description: 'Nueva fecha en formato YYYY-MM-DD.'
          },
          nueva_hora: {
            type: 'string',
            description: 'Nueva hora en formato HH:MM. Opcional, mantiene la hora actual si no se especifica.'
          }
        },
        required: ['booking_id', 'uid', 'nueva_fecha']
      }
    },
    {
      name: 'cancelar_reserva',
      description: 'Cancela una reserva existente. Solo ejecutar después de confirmación explícita del cliente.',
      parameters: {
        type: 'object',
        properties: {
          booking_id: {
            type: 'string',
            description: 'ID del documento de la reserva en Firestore.'
          },
          uid: {
            type: 'string',
            description: 'UID del cliente en Firebase.'
          }
        },
        required: ['booking_id', 'uid']
      }
    },
    {
      name: 'obtener_reserva',
      description: 'Obtiene todos los detalles de una reserva específica por su ID.',
      parameters: {
        type: 'object',
        properties: {
          booking_id: {
            type: 'string',
            description: 'ID del documento de la reserva en Firestore.'
          }
        },
        required: ['booking_id']
      }
    },
    {
      name: 'crear_reserva',
      description: 'Crea una nueva reserva con estado Pendiente de Pago. Usar cuando un cliente quiere agendar un servicio nuevo.',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre completo del cliente.' },
          email: { type: 'string', description: 'Email del cliente para notificaciones.' },
          fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD.' },
          hora: { type: 'string', description: 'Hora en formato HH:MM.' },
          formato: {
            type: 'string',
            enum: ['completo', 'meio'],
            description: 'completo = turno completo 9hs, meio = medio turno 4hs.'
          },
          frecuencia: {
            type: 'string',
            enum: ['avulso', 'mensal'],
            description: 'avulso = servicio único, mensal = paquete mensual.'
          },
          notas_especiales: {
            type: 'string',
            description: 'Requerimientos especiales del cliente (alergias, protocolos, etc.). Opcional.'
          }
        },
        required: ['nombre', 'email', 'fecha', 'hora', 'formato', 'frecuencia']
      }
    }
  ]
};

// ─── Ejecutor de funciones ─────────────────────────────────────────────────────

async function executeTool(name: string, args: any): Promise<any> {
  console.log(`[Concierge Tool] Executing: ${name}`, args);
  try {
    switch (name) {
      case 'buscar_reserva':
        return await buscarReserva(args.nombre);
      case 'verificar_disponibilidad':
        return await verificarDisponibilidad(args.fecha, args.hora);
      case 'cambiar_fecha_reserva':
        return await cambiarFechaReserva(args.booking_id, args.uid, args.nueva_fecha, args.nueva_hora);
      case 'cancelar_reserva':
        return await cancelarReserva(args.booking_id, args.uid);
      case 'obtener_reserva':
        return await obtenerReserva(args.booking_id);
      case 'crear_reserva':
        return await crearReserva(
          args.nombre, args.email, args.fecha, args.hora,
          args.formato, args.frecuencia, args.notas_especiales
        );
      default:
        return { success: false, error: `Función desconocida: ${name}` };
    }
  } catch (err) {
    console.error(`[Concierge Tool Error] ${name}:`, err);
    return { success: false, error: String(err) };
  }
}

// ─── Handler Principal ─────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contents } = req.body;
  if (!contents || !Array.isArray(contents)) {
    return res.status(400).json({ error: 'Missing contents array' });
  }

  // ── Diagnóstico de configuración ─────────────────────────────────────────────
  const config = {
    hasGemini:   !!process.env.GEMINI_API_KEY,
    hasNvidia:   !!process.env.NVIDIA_API_KEY,
    hasOpenAI:   !!process.env.OPENAI_API_KEY,
    hasFirebaseProject: !!process.env.FIREBASE_PROJECT_ID,
    hasFirebaseEmail:   !!process.env.FIREBASE_CLIENT_EMAIL,
    hasFirebaseKey:     !!process.env.FIREBASE_PRIVATE_KEY,
    hasResend:   !!process.env.RESEND_API_KEY,
  };
  console.log('[chat.ts] Config check:', JSON.stringify(config));

  // ── Gemini con Function Calling (preferido) ──────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

      let currentContents = [...contents];
      const MAX_TOOL_ROUNDS = 5; // máximo de rondas de function calling

      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const body = JSON.stringify({
          contents: currentContents,
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          tools: [TOOL_DECLARATIONS],
          generationConfig: {
            temperature: 0.3,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 500
          }
        });

        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          console.error('[chat.ts] Gemini API error status:', geminiRes.status, 'body:', errText);
          throw new Error(`Gemini API ${geminiRes.status}: ${errText.slice(0, 300)}`);
        }

        const data = await geminiRes.json();
        const candidate = data.candidates?.[0];
        if (!candidate) break;

        const parts = candidate.content?.parts || [];
        const functionCalls = parts.filter((p: any) => p.functionCall);

        // Si no hay function calls → respuesta final de texto
        if (functionCalls.length === 0) {
          const text = parts.find((p: any) => p.text)?.text || '';
          return res.status(200).json({ text });
        }

        // Hay function calls → ejecutarlos todos y devolver resultados
        const toolResponseParts: any[] = [];

        for (const part of functionCalls) {
          const { name, args } = part.functionCall;
          const result = await executeTool(name, args);
          toolResponseParts.push({
            functionResponse: {
              name,
              response: result
            }
          });
        }

        // Agregar la respuesta del modelo y los resultados de las funciones al historial
        currentContents = [
          ...currentContents,
          { role: 'model', parts },
          { role: 'user', parts: toolResponseParts }
        ];

        // Continuar el loop para que Gemini procese los resultados
      }

      // Si agotamos las rondas sin respuesta final, fallback genérico
      return res.status(200).json({
        text: 'Disculpe, hubo un inconveniente procesando su solicitud. Por favor intente nuevamente o contáctenos directamente.'
      });

    } catch (e) {
      console.error('Gemini Function Calling error:', e);
    }
  }

  // ── NVIDIA NIM (fallback sin function calling) ────────────────────────────────
  if (process.env.NVIDIA_API_KEY) {
    try {
      const messages = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        ...contents.map((c: any) => ({
          role: c.role === 'model' ? 'assistant' : 'user',
          content: c.parts?.[0]?.text || ''
        }))
      ];
      const nvidiaRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}` },
        body: JSON.stringify({ model: 'meta/llama-3.1-8b-instruct', messages, temperature: 0.4, max_tokens: 250 })
      });
      if (nvidiaRes.ok) {
        const data = await nvidiaRes.json();
        return res.status(200).json({ text: data.choices?.[0]?.message?.content || '' });
      }
    } catch (e) {
      console.error('NVIDIA error:', e);
    }
  }

  // ── OpenAI (segundo fallback) ─────────────────────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    try {
      const messages = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        ...contents.map((c: any) => ({
          role: c.role === 'model' ? 'assistant' : 'user',
          content: c.parts?.[0]?.text || ''
        }))
      ];
      const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.4, max_tokens: 250 })
      });
      if (openAiRes.ok) {
        const data = await openAiRes.json();
        return res.status(200).json({ text: data.choices?.[0]?.message?.content || '' });
      }
    } catch (e) {
      console.error('OpenAI error:', e);
    }
  }

  return res.status(500).json({
    error: 'AI Config Error: No valid AI backend configured.'
  });
}
