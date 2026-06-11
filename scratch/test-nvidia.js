import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const apiKey = process.env.NVIDIA_API_KEY;
  console.log('API Key exists:', !!apiKey);

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'meta/llama-4-maverick-17b-128e-instruct',
      messages: [
        { role: 'system', content: 'Você é um assistente. VOCÊ DEVE RESPONDER SEMPRE EM PORTUGUÊS BRASILEIRO (Português-BR)!' },
        { role: 'user', content: 'Hola' }
      ],
      temperature: 0.3,
      max_tokens: 100
    })
  });

  console.log('Status:', response.status);
  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
}

test();
