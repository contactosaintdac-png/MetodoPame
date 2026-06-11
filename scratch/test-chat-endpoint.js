import fs from 'fs';

// Load credentials and set env vars synchronously before any ESM imports
const credentials = JSON.parse(fs.readFileSync('C:\\Users\\leshx\\.gemini\\prospectadac-firebase-adminsdk-fbsvc-02b8129179.json', 'utf8'));
process.env.FIREBASE_PROJECT_ID = credentials.project_id;
process.env.FIREBASE_CLIENT_EMAIL = credentials.client_email;
process.env.FIREBASE_PRIVATE_KEY = credentials.private_key;
process.env.NVIDIA_API_KEY = "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";
process.env.RESEND_API_KEY = "re_mock_api_key_for_test"; 

// Mock Vercel Request & Response
const req = {
  method: 'POST',
  body: {
    contents: [
      { role: 'user', parts: [{ text: 'Quero trocar minha reserva de Saint para o dia 28 de junho' }] }
    ],
    context: {
      uid: 'w6ZsmQxOT7ZW0KtZ86LNvROBGyG3',
      name: 'Saint',
      bookings: [
        { id: 'Tbw5kEYGrv9sJZnipDqJ', date: '2026-06-10', time: '09:00', status: 'Confirmado', service: 'completo' }
      ]
    }
  }
};

const res = {
  status(code) {
    console.log('[Status]', code);
    return this;
  },
  json(data) {
    console.log('[JSON Response]', JSON.stringify(data, null, 2));
    return this;
  },
  setHeader() {},
  end() {}
};

async function runTest() {
  console.log('Starting local chat API test...');
  console.time('apiCallTime');
  try {
    // Dynamic import to prevent hoisting issues
    const { default: handler } = await import('../api/chat.ts');
    await handler(req, res);
  } catch (err) {
    console.error('Test threw error:', err);
  }
  console.timeEnd('apiCallTime');
}

runTest();
