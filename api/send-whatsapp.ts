import { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let { phone, employeeId, templateName, parameters } = req.body;

  if (!phone && employeeId) {
    try {
      const empDoc = await db.collection('employees').doc(employeeId).get();
      if (empDoc.exists) {
        const empData = empDoc.data();
        if (empData && empData.whatsapp) {
          phone = empData.whatsapp;
        }
      }
    } catch (err) {
      console.error('[WhatsApp API] Error fetching employee details:', err);
    }
  }

  if (!phone || !templateName || !parameters || !Array.isArray(parameters)) {
    return res.status(400).json({ error: 'Fields phone (or employeeId), templateName, and parameters (array) are required' });
  }

  const phoneId = process.env.VITE_WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.VITE_WHATSAPP_ACCESS_TOKEN;

  if (!phoneId || !token) {
    console.error('[WhatsApp] Meta credentials VITE_WHATSAPP_PHONE_NUMBER_ID or VITE_WHATSAPP_ACCESS_TOKEN are missing in environment variables');
    return res.status(500).json({ error: 'WhatsApp API credentials are not configured in Vercel environment variables.' });
  }

  // Sanitize phone number (remove non-digits, ensure country code 55 for Brazil)
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length > 0) {
    if (!cleanPhone.startsWith('55') && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
      cleanPhone = '55' + cleanPhone;
    }
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: cleanPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: 'pt_BR'
      },
      components: [
        {
          type: 'body',
          parameters: parameters.map((param: any) => ({
            type: 'text',
            text: String(param)
          }))
        }
      ]
    }
  };

  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;

  try {
    console.log(`[WhatsApp] Sending template "${templateName}" to ${cleanPhone} with params:`, parameters);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[WhatsApp Error response from Meta]:', JSON.stringify(data));
      return res.status(response.status).json({ error: data.error || 'Meta API error' });
    }

    console.log('[WhatsApp Success response from Meta]:', data);
    return res.status(200).json(data);
  } catch (err) {
    console.error('[WhatsApp Unexpected Server Error]:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown Server Error' });
  }
}
