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
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1. Fetch active employees (only those with active: true)
    const empSnap = await db.collection('employees')
      .where('active', '==', true)
      .get();

    const employees = empSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || '',
        weeklyAvailability: data.weeklyAvailability || { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }
      };
    });

    // 2. Fetch blocks for all active employees
    const blocks: Record<string, Record<string, string[]>> = {};
    for (const emp of employees) {
      blocks[emp.id] = {};
      const blocksSnap = await db.collection('employee_schedules')
        .doc(emp.id)
        .collection('blocks')
        .get();

      blocksSnap.docs.forEach(doc => {
        blocks[emp.id][doc.id] = doc.data().shifts || [];
      });
    }

    return res.status(200).json({ employees, blocks });
  } catch (err: any) {
    console.error('Error in get-availability:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message || err });
  }
}
