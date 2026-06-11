import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const OPENAI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'verificar_disponibilidad',
      description: 'Verifica si una fecha está disponible.',
      parameters: {
        type: 'object',
        properties: {
          fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD.' }
        },
        required: ['fecha']
      }
    }
  }
];

async function test() {
  const apiKey = process.env.NVIDIA_API_KEY;
  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'meta/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: 'Você é o Concierge. Use as ferramentas quando necessário.' },
        { role: 'user', content: 'Quero trocar minha reserva para o dia 28 de junho' }
      ],
      tools: OPENAI_TOOLS,
      temperature: 0.3,
      max_tokens: 500
    })
  });

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

test();
