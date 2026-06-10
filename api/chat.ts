import { VercelRequest, VercelResponse } from '@vercel/node';

const SYSTEM_INSTRUCTION = `Eres el Concierge exclusivo del Método Pame, un servicio élite de curaduría del hogar y limpieza profunda de lujo con sede en Argentina.

ROL Y LIMITACIONES ABSOLUTAS:
- Eres un asistente de PRIMER CONTACTO. Tu único rol es RECIBIR y REGISTRAR la solicitud del cliente con calidez y elegancia.
- NO tienes acceso a ningún sistema de reservas, agenda, base de datos ni información de clientes. JAMÁS simules que estás verificando, consultando o ejecutando algo en un sistema.
- NUNCA digas frases como "estoy verificando", "en breve tendré novedades", "voy a checar la disponibilidad", "déjeme confirmar" — porque no puedes hacerlo y sería una promesa falsa.
- NUNCA confirmes disponibilidad, cambios de reserva ni ninguna acción concreta.
- NO hables de precios.

LO QUE SÍ DEBES HACER:
- Recibir la solicitud del cliente con calidez y elegancia.
- Confirmar que su pedido quedó REGISTRADO y que un miembro del equipo de Método Pame lo contactará a la brevedad para gestionar su solicitud.
- Si el cliente tiene requerimientos especiales (alergias, protocolos, preferencias de limpieza), registrarlos y confirmar que el equipo los tendrá en cuenta.

TONO Y ESTILO:
- Extremadamente cordial, cálido y de lujo. Siempre en primera persona plural ("nuestro equipo", "con mucho gusto lo asistiremos").
- Respuestas MUY breves: máximo 2-3 líneas. Conciso, elegante, sin vueltas.

EJEMPLO CORRECTO cuando piden cambio de reserva:
"Hemos registrado su solicitud de cambio para el 28 de junio. Un miembro de nuestro equipo se pondrá en contacto con usted a la brevedad para confirmarlo."

EJEMPLO INCORRECTO (PROHIBIDO):
"Estoy verificando la disponibilidad... / En breve tendré novedades / Déjeme checar su reserva."`;


export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { contents } = req.body;
  if (!contents || !Array.isArray(contents)) {
    return res.status(400).json({ error: 'Missing contents array' });
  }

  // 1. Try NVIDIA NIM if NVIDIA_API_KEY is present
  if (process.env.NVIDIA_API_KEY) {
    try {
      // Map Gemini style contents to standard messages
      const messages = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        ...contents.map(c => ({
          role: c.role === 'model' ? 'assistant' : 'user',
          content: c.parts?.[0]?.text || ''
        }))
      ];

      const nvidiaResponse = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
        },
        body: JSON.stringify({
          model: 'meta/llama-3.1-8b-instruct',
          messages,
          temperature: 0.4,
          max_tokens: 250
        })
      });

      if (nvidiaResponse.ok) {
        const data = await nvidiaResponse.json();
        const text = data.choices?.[0]?.message?.content || '';
        return res.status(200).json({ text });
      } else {
        const errText = await nvidiaResponse.text();
        console.error("NVIDIA API error:", errText);
      }
    } catch (e) {
      console.error("Failed to call NVIDIA:", e);
    }
  }

  // 2. Try OpenAI if OPENAI_API_KEY is present
  if (process.env.OPENAI_API_KEY) {
    try {
      // Map Gemini style contents to OpenAI messages
      const messages = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        ...contents.map(c => ({
          role: c.role === 'model' ? 'assistant' : 'user',
          content: c.parts?.[0]?.text || ''
        }))
      ];

      const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages,
          temperature: 0.4,
          max_tokens: 250
        })
      });

      if (openAiResponse.ok) {
        const data = await openAiResponse.json();
        const text = data.choices?.[0]?.message?.content || '';
        return res.status(200).json({ text });
      } else {
        const errText = await openAiResponse.text();
        console.error("OpenAI API error:", errText);
      }
    } catch (e) {
      console.error("Failed to call OpenAI:", e);
    }
  }

  // 3. Try Gemini if GEMINI_API_KEY is present
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          systemInstruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }]
          },
          generationConfig: {
            temperature: 0.4,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 250
          }
        })
      });

      if (geminiResponse.ok) {
        const data = await geminiResponse.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return res.status(200).json({ text });
      } else {
        const errText = await geminiResponse.text();
        console.error("Gemini API error:", errText);
      }
    } catch (e) {
      console.error("Failed to call Gemini:", e);
    }
  }

  return res.status(500).json({
    error: 'AI Config Error: Neither NVIDIA_API_KEY, OPENAI_API_KEY, nor GEMINI_API_KEY backend environment variable is set or valid.'
  });
}
