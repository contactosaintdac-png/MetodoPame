/**
 * api/chat.ts — Concierge IA con Gemini Function Calling
 * IMPORTANTE: Todo el código está en UN solo archivo para compatibilidad con Vercel ESM.
 * Vercel no bundlea imports locales entre archivos /api/ con "type":"module".
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { Resend } from 'resend';

// ─── Firebase Admin — inicialización LAZY ─────────────────────────────────────

let _db: admin.firestore.Firestore | null = null;

function getDb(): admin.firestore.Firestore {
  if (_db) return _db;
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Firebase Admin credentials missing in Vercel env');
  }
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
  _db = admin.firestore();
  return _db;
}

const resend = new Resend(process.env.RESEND_API_KEY);
const PAME_EMAIL = process.env.PAME_EMAIL || 'metodopame.homedetail@gmail.com';
const DEV_EMAIL  = process.env.DEV_EMAIL  || 'contactosaintdac@gmail.com';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ToolResult { success: boolean; data?: any; error?: string; }

interface NotificacionParams {
  accion: 'cambio_fecha' | 'cancelacion' | 'nueva_reserva_pendiente';
  nombreCliente: string; emailCliente: string;
  fechaAnterior?: string; horaAnterior?: string;
  nuevaFecha?: string; nuevaHora?: string;
  empleadaNombre?: string; empleadaEmail?: string;
  formato?: string; precio?: number; notas?: string;
}

// ─── System Prompt ─────────────────────────────────────────────────────────────

const getSystemInstruction = () => `Eres el Concierge exclusivo del Método Pame, un servicio élite de curaduría del hogar y limpieza profunda de lujo con sede en Brasil.
HOY ES: ${new Date().toISOString().split('T')[0]}. Usa este año para cualquier cálculo de fecha.

ROL Y CAPACIDADES:
Tenés acceso a herramientas reales para gestionar reservas. Podés buscar, reagendar, cancelar y crear reservas directamente en el sistema — sin intermediarios.

CÓMO ACTUAR:
- Cuando un cliente quiera cambiar su reserva: primero buscá la reserva por nombre, luego verificá disponibilidad en la nueva fecha, luego ejecutá el cambio.
- Cuando un cliente quiera cancelar: buscá la reserva, confirmá verbalmente "¿Confirma la cancelación?", esperá su respuesta, y recién entonces cancelá.
- Cuando un cliente quiera una reserva nueva: recopilá nombre, email, fecha, hora y formato (meio=4hs / completo=9hs), luego creá la reserva.
- Cuando uses una herramienta, actuá con naturalidad — nunca menciones términos técnicos.

TONO Y ESTILO:
- Extremadamente cordial, cálido, de lujo. Primera persona plural ("nuestro equipo").
- Respuestas MUY breves: máximo 2-3 líneas. Conciso, elegante, sin rodeos.
- Siempre confirmá las acciones ejecutadas con los datos reales del sistema.

LÍMITES:
- NO hables de precios directamente.
- Si no encontrás la reserva, pedí amablemente que verifique su nombre.
- Ante cualquier error, indicá que el equipo lo contactará a la brevedad.`;

// ─── Declaración de Tools para Gemini ─────────────────────────────────────────

const TOOL_DECLARATIONS = {
  functionDeclarations: [
    {
      name: 'buscar_reserva',
      description: 'Busca una reserva activa en el sistema por nombre del cliente. Usar antes de cualquier otra acción.',
      parameters: { type: 'object', properties: { nombre: { type: 'string', description: 'Nombre completo o parcial del cliente.' } }, required: ['nombre'] }
    },
    {
      name: 'verificar_disponibilidad',
      description: 'Verifica si una fecha (y opcionalmente hora) está disponible.',
      parameters: { type: 'object', properties: { fecha: { type: 'string', description: 'Fecha en formato YYYY-MM-DD.' }, hora: { type: 'string', description: 'Hora en formato HH:MM. Opcional.' } }, required: ['fecha'] }
    },
    {
      name: 'cambiar_fecha_reserva',
      description: 'Cambia la fecha (y opcionalmente hora) de una reserva. Requiere bookingId y uid.',
      parameters: { type: 'object', properties: { booking_id: { type: 'string' }, uid: { type: 'string' }, nueva_fecha: { type: 'string', description: 'YYYY-MM-DD' }, nueva_hora: { type: 'string', description: 'HH:MM. Opcional.' } }, required: ['booking_id', 'uid', 'nueva_fecha'] }
    },
    {
      name: 'cancelar_reserva',
      description: 'Cancela una reserva. Solo ejecutar tras confirmación explícita del cliente.',
      parameters: { type: 'object', properties: { booking_id: { type: 'string' }, uid: { type: 'string' } }, required: ['booking_id', 'uid'] }
    },
    {
      name: 'obtener_reserva',
      description: 'Obtiene todos los detalles de una reserva por su ID.',
      parameters: { type: 'object', properties: { booking_id: { type: 'string' } }, required: ['booking_id'] }
    },
    {
      name: 'crear_reserva',
      description: 'Crea una nueva reserva con estado Pendiente de Pago.',
      parameters: { type: 'object', properties: { nombre: { type: 'string' }, email: { type: 'string' }, fecha: { type: 'string' }, hora: { type: 'string' }, formato: { type: 'string', enum: ['completo', 'meio'] }, frecuencia: { type: 'string', enum: ['avulso', 'mensal'] }, notas_especiales: { type: 'string' } }, required: ['nombre', 'email', 'fecha', 'hora', 'formato', 'frecuencia'] }
    }
  ]
};

// ─── Funciones de Firestore ────────────────────────────────────────────────────

async function buscarReserva(nombre: string): Promise<ToolResult> {
  try {
    const db = getDb();
    const nombreLower = nombre.toLowerCase().trim();
    const exactQ = await db.collection('reservas_index').where('nombre_lower', '==', nombreLower).where('estado', '!=', 'Cancelado').limit(3).get();
    if (!exactQ.empty) return { success: true, data: { reservas: exactQ.docs.map(d => ({ id: d.id, ...d.data() })), total: exactQ.size } };
    const partialQ = await db.collection('reservas_index').where('nombre_lower', '>=', nombreLower).where('nombre_lower', '<=', nombreLower + '\uf8ff').where('estado', '!=', 'Cancelado').limit(5).get();
    if (!partialQ.empty) return { success: true, data: { reservas: partialQ.docs.map(d => ({ id: d.id, ...d.data() })), total: partialQ.size } };
    return { success: false, error: `No encontré reservas activas para "${nombre}". Por favor verifique el nombre.` };
  } catch (e: any) { console.error('[buscarReserva]', e.message); return { success: false, error: e.message }; }
}

async function verificarDisponibilidad(fecha: string, hora?: string): Promise<ToolResult> {
  try {
    const db = getDb();
    const snap = await db.collection('reservas_index').where('fecha', '==', fecha).where('estado', '==', 'Confirmado').get();
    const reservas = snap.docs.map(d => d.data() as any);
    if (hora && reservas.some((r: any) => r.hora === hora)) {
      return { success: true, data: { disponible: false, fecha, hora, mensaje: `El horario ${hora} del ${fecha} ya está ocupado.` } };
    }
    return { success: true, data: { disponible: true, fecha, hora: hora || 'cualquier horario', mensaje: `El ${fecha}${hora ? ` a las ${hora}` : ''} está disponible.`, reservas_en_fecha: reservas.length } };
  } catch (e: any) { return { success: false, error: e.message }; }
}

async function cambiarFechaReserva(bookingId: string, uid: string, nuevaFecha: string, nuevaHora?: string): Promise<ToolResult> {
  try {
    const db = getDb();
    const indexRef   = db.collection('reservas_index').doc(bookingId);
    const bookingRef = db.collection('users').doc(uid).collection('bookings').doc(bookingId);
    const [iSnap, bSnap] = await Promise.all([indexRef.get(), bookingRef.get()]);
    if (!iSnap.exists || !bSnap.exists) return { success: false, error: 'No se encontró la reserva.' };
    const iData = iSnap.data() as any;
    const fechaAnterior = iData.fecha; const horaAnterior = iData.hora;
    const upd: any = { fecha: nuevaFecha, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (nuevaHora) upd.hora = nuevaHora;
    await Promise.all([indexRef.update(upd), bookingRef.update({ date: nuevaFecha, ...(nuevaHora ? { time: nuevaHora } : {}), updatedAt: admin.firestore.FieldValue.serverTimestamp() })]);
    enviarNotificacion({ accion: 'cambio_fecha', nombreCliente: iData.nombre, emailCliente: iData.email, fechaAnterior, horaAnterior, nuevaFecha, nuevaHora: nuevaHora || iData.hora, empleadaNombre: iData.empleada_nombre, empleadaEmail: iData.empleada_email, formato: iData.formato, precio: iData.precio });
    return { success: true, data: { mensaje: `Reserva de ${iData.nombre} cambiada: ${fechaAnterior} → ${nuevaFecha}${nuevaHora ? ` a las ${nuevaHora}` : ''}.`, bookingId, fechaAnterior, nuevaFecha } };
  } catch (e: any) { console.error('[cambiarFechaReserva]', e.message); return { success: false, error: e.message }; }
}

async function cancelarReserva(bookingId: string, uid: string): Promise<ToolResult> {
  try {
    const db = getDb();
    const indexRef   = db.collection('reservas_index').doc(bookingId);
    const bookingRef = db.collection('users').doc(uid).collection('bookings').doc(bookingId);
    const iSnap = await indexRef.get();
    if (!iSnap.exists) return { success: false, error: 'No se encontró la reserva.' };
    const iData = iSnap.data() as any;
    await Promise.all([indexRef.update({ estado: 'Cancelado', updatedAt: admin.firestore.FieldValue.serverTimestamp() }), bookingRef.update({ status: 'Cancelado', updatedAt: admin.firestore.FieldValue.serverTimestamp() })]);
    enviarNotificacion({ accion: 'cancelacion', nombreCliente: iData.nombre, emailCliente: iData.email, fechaAnterior: iData.fecha, horaAnterior: iData.hora, empleadaNombre: iData.empleada_nombre, empleadaEmail: iData.empleada_email });
    return { success: true, data: { mensaje: `Reserva de ${iData.nombre} del ${iData.fecha} cancelada.`, bookingId } };
  } catch (e: any) { console.error('[cancelarReserva]', e.message); return { success: false, error: e.message }; }
}

async function obtenerReserva(bookingId: string): Promise<ToolResult> {
  try {
    const snap = await getDb().collection('reservas_index').doc(bookingId).get();
    if (!snap.exists) return { success: false, error: 'No se encontró la reserva.' };
    return { success: true, data: { id: snap.id, ...snap.data() } };
  } catch (e: any) { return { success: false, error: e.message }; }
}

async function crearReserva(nombre: string, email: string, fecha: string, hora: string, formato: string, frecuencia: string, notasEspeciales?: string): Promise<ToolResult> {
  try {
    const db = getDb();
    const precio = formato === 'completo' ? 450 : 350;
    const newDoc = await db.collection('reservas_index').add({ uid: 'pendiente', bookingId: '', nombre, nombre_lower: nombre.toLowerCase().trim(), email, fecha, hora, formato, frecuencia, estado: 'Pendiente de Pago', empleada_nombre: '', empleada_email: '', empleada_id: '', precio, notas_especiales: notasEspeciales || '', createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    await newDoc.update({ bookingId: newDoc.id });
    enviarNotificacion({ accion: 'nueva_reserva_pendiente', nombreCliente: nombre, emailCliente: email, nuevaFecha: fecha, nuevaHora: hora, formato, precio, notas: notasEspeciales });
    return { success: true, data: { mensaje: `Reserva creada para ${nombre} el ${fecha} a las ${hora}. Pendiente de Pago. El equipo contactará al cliente.`, bookingId: newDoc.id } };
  } catch (e: any) { console.error('[crearReserva]', e.message); return { success: false, error: e.message }; }
}

// ─── Ejecutor de herramientas ─────────────────────────────────────────────────

async function executeTool(name: string, args: any): Promise<any> {
  console.log(`[Concierge] Tool: ${name}`, JSON.stringify(args));
  switch (name) {
    case 'buscar_reserva':          return buscarReserva(args.nombre);
    case 'verificar_disponibilidad': return verificarDisponibilidad(args.fecha, args.hora);
    case 'cambiar_fecha_reserva':   return cambiarFechaReserva(args.booking_id, args.uid, args.nueva_fecha, args.nueva_hora);
    case 'cancelar_reserva':        return cancelarReserva(args.booking_id, args.uid);
    case 'obtener_reserva':         return obtenerReserva(args.booking_id);
    case 'crear_reserva':           return crearReserva(args.nombre, args.email, args.fecha, args.hora, args.formato, args.frecuencia, args.notas_especiales);
    default:                        return { success: false, error: `Función desconocida: ${name}` };
  }
}

// ─── Emails vía Resend ────────────────────────────────────────────────────────

function enviarNotificacion(params: NotificacionParams): void {
  // Fire-and-forget — no bloquea la respuesta al cliente
  const { accion, nombreCliente, emailCliente, fechaAnterior, horaAnterior, nuevaFecha, nuevaHora, empleadaNombre, empleadaEmail, formato, precio, notas } = params;

  const accionLabel = accion === 'cambio_fecha' ? 'Cambio de Fecha via Concierge IA' : accion === 'cancelacion' ? 'Cancelación via Concierge IA' : 'Nueva Reserva — Pendiente de Pago';
  const subjectAdmin = accion === 'cambio_fecha' ? `🤖 IA Reagendó: ${nombreCliente} → ${nuevaFecha}` : accion === 'cancelacion' ? `🤖 IA Canceló: ${nombreCliente} (${fechaAnterior})` : `🤖 IA Creó Reserva: ${nombreCliente} — ${nuevaFecha}`;
  const subjectCliente = accion === 'cambio_fecha' ? `Su reserva fue reagendada al ${nuevaFecha} — MÉTODO PAME` : accion === 'cancelacion' ? `Cancelación confirmada — MÉTODO PAME` : `Reserva registrada — Pendiente de Pago | MÉTODO PAME`;

  const detalleRows = accion === 'cambio_fecha'
    ? `<tr><td style="color:#80737f;padding-right:20px;">Anterior:</td><td style="font-weight:600;">${fechaAnterior} ${horaAnterior||''}</td></tr><tr><td style="color:#80737f;padding-right:20px;">Nueva fecha:</td><td style="font-weight:700;color:#703081;">${nuevaFecha} ${nuevaHora||''}</td></tr>`
    : accion === 'cancelacion'
    ? `<tr><td style="color:#80737f;padding-right:20px;">Fecha cancelada:</td><td style="font-weight:600;color:#c0392b;">${fechaAnterior} ${horaAnterior||''}</td></tr>`
    : `<tr><td style="color:#80737f;padding-right:20px;">Fecha:</td><td style="font-weight:600;">${nuevaFecha} ${nuevaHora||''}</td></tr><tr><td style="color:#80737f;padding-right:20px;">Formato:</td><td style="font-weight:600;">${formato}</td></tr><tr><td style="color:#80737f;padding-right:20px;">Precio base:</td><td style="font-weight:700;color:#703081;">R$ ${precio}</td></tr>${notas?`<tr><td style="color:#80737f;padding-right:20px;">Notas:</td><td style="font-weight:600;">${notas}</td></tr>`:''}`;

  const adminHtml = `<div style="background:#fff7fd;padding:40px 20px;font-family:Manrope,Helvetica,Arial,sans-serif;color:#1e1a20;"><div style="max-width:600px;margin:0 auto;background:#f8f7f9;border-radius:12px;overflow:hidden;"><div style="padding:32px;border-bottom:1px solid #efe5ee;text-align:center;"><h1 style="margin:0;font-size:22px;font-weight:800;color:#561668;letter-spacing:2px;text-transform:uppercase;">MÉTODO PAME</h1><p style="margin:8px 0 0;font-size:11px;color:#80737f;text-transform:uppercase;letter-spacing:1px;">🤖 ${accionLabel}</p></div><div style="padding:32px;"><div style="background:#f4ebf4;border-radius:8px;padding:20px;"><table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#1e1a20;line-height:2.2;"><tr><td style="color:#80737f;padding-right:20px;width:120px;">Cliente:</td><td style="font-weight:600;">${nombreCliente}</td></tr><tr><td style="color:#80737f;padding-right:20px;">Email:</td><td style="font-weight:600;">${emailCliente}</td></tr>${empleadaNombre?`<tr><td style="color:#80737f;padding-right:20px;">Especialista:</td><td style="font-weight:600;">${empleadaNombre}</td></tr>`:''}${detalleRows}</table></div></div><div style="background:#561668;padding:20px 32px;text-align:center;"><p style="margin:0;font-size:11px;font-weight:600;color:#fcd7ff;letter-spacing:1px;text-transform:uppercase;">Sistema Concierge IA | MÉTODO PAME</p></div></div></div>`;

  const clienteMsg = accion === 'cambio_fecha' ? `Su reserva ha sido reagendada al <strong>${nuevaFecha}${nuevaHora ? ` a las ${nuevaHora} hs` : ''}</strong>.` : accion === 'cancelacion' ? `Su reserva del ${fechaAnterior} fue cancelada según su solicitud.` : `Su reserva para el <strong>${nuevaFecha}${nuevaHora ? ` a las ${nuevaHora} hs` : ''}</strong> está registrada. Nuestro equipo lo contactará para coordinar el pago.`;
  const clienteHtml = `<div style="background:#fff7fd;padding:40px 20px;font-family:Manrope,Helvetica,Arial,sans-serif;color:#1e1a20;"><div style="max-width:600px;margin:0 auto;background:#f8f7f9;border-radius:12px;overflow:hidden;"><div style="padding:32px;border-bottom:1px solid #efe5ee;text-align:center;"><h1 style="margin:0;font-size:22px;font-weight:800;color:#561668;letter-spacing:2px;text-transform:uppercase;">MÉTODO PAME</h1></div><div style="padding:32px;"><h2 style="margin:0 0 12px;font-size:18px;">Estimado/a ${nombreCliente},</h2><p style="font-size:14px;line-height:1.7;color:#4e434e;">${clienteMsg}</p></div><div style="background:#561668;padding:20px 32px;text-align:center;"><p style="margin:0;font-size:11px;font-weight:600;color:#fcd7ff;letter-spacing:1px;text-transform:uppercase;">Método Pame | Home Detail de Lujo</p></div></div></div>`;

  const emails: Promise<any>[] = [
    resend.emails.send({ from: 'Método Pame <reservas@metodopame.com>', to: [PAME_EMAIL], subject: subjectAdmin, html: adminHtml }),
    resend.emails.send({ from: 'Método Pame <reservas@metodopame.com>', to: [DEV_EMAIL], subject: `[Auditoría] ${subjectAdmin}`, html: adminHtml }),
    resend.emails.send({ from: 'Método Pame <reservas@metodopame.com>', to: [emailCliente], subject: subjectCliente, html: clienteHtml }),
  ];
  if (empleadaEmail && (accion === 'cambio_fecha' || accion === 'cancelacion')) {
    const empMsg = accion === 'cambio_fecha' ? `Tu servicio con <strong>${nombreCliente}</strong> fue reagendado: <strong>${fechaAnterior}</strong> → <strong>${nuevaFecha}${nuevaHora ? ` a las ${nuevaHora}` : ''}</strong>.` : `El servicio con <strong>${nombreCliente}</strong> del <strong>${fechaAnterior}</strong> fue cancelado.`;
    emails.push(resend.emails.send({ from: 'Método Pame <reservas@metodopame.com>', to: [empleadaEmail], subject: accion === 'cambio_fecha' ? `Actualización de agenda: ${nombreCliente}` : `Servicio cancelado: ${nombreCliente}`, html: `<div style="background:#fff7fd;padding:32px;font-family:Manrope,Helvetica,Arial,sans-serif;"><h1 style="color:#561668;">MÉTODO PAME</h1><p>Hola, ${empleadaNombre}.</p><p style="font-size:14px;line-height:1.7;">${empMsg}</p></div>` }));
  }
  Promise.allSettled(emails).catch(err => console.error('[Resend]', err));
}

// ─── Handler HTTP ─────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contents } = req.body;
  if (!contents || !Array.isArray(contents)) return res.status(400).json({ error: 'Missing contents array' });

  // Diagnóstico
  console.log('[chat] Config:', JSON.stringify({ gemini: !!process.env.GEMINI_API_KEY, fbProject: !!process.env.FIREBASE_PROJECT_ID, fbEmail: !!process.env.FIREBASE_CLIENT_EMAIL, fbKey: !!process.env.FIREBASE_PRIVATE_KEY, resend: !!process.env.RESEND_API_KEY }));

  // ── Gemini con Function Calling ───────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
      let currentContents = [...contents];

      for (let round = 0; round < 6; round++) {
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: currentContents,
            systemInstruction: { parts: [{ text: getSystemInstruction() }] },
            tools: [TOOL_DECLARATIONS],
            generationConfig: { temperature: 0.3, topK: 40, topP: 0.95, maxOutputTokens: 500 }
          })
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          console.error('[chat] Gemini error', geminiRes.status, errText.slice(0, 500));
          throw new Error(`Gemini ${geminiRes.status}`);
        }

        const data = await geminiRes.json();
        const candidate = data.candidates?.[0];
        if (!candidate) break;

        const parts: any[] = candidate.content?.parts || [];
        const functionCalls = parts.filter((p: any) => p.functionCall);

        // Sin function calls → respuesta final de texto
        if (functionCalls.length === 0) {
          const text = parts.find((p: any) => p.text)?.text || '';
          return res.status(200).json({ text });
        }

        // Ejecutar todas las herramientas
        const toolResponses: any[] = [];
        for (const part of functionCalls) {
          const result = await executeTool(part.functionCall.name, part.functionCall.args);
          toolResponses.push({ functionResponse: { name: part.functionCall.name, response: result } });
        }

        // Agregar ronda al historial y continuar
        currentContents = [...currentContents, { role: 'model', parts }, { role: 'user', parts: toolResponses }];
      }

      return res.status(200).json({ text: 'Disculpe, tuve un inconveniente. Por favor intente nuevamente.' });

    } catch (e: any) {
      console.error('[chat] Gemini catch:', e.message);
      // Continúa a los fallbacks
    }
  }

  // ── NVIDIA NIM (fallback sin function calling) ────────────────────────────────
  if (process.env.NVIDIA_API_KEY) {
    try {
      const messages = [{ role: 'system', content: getSystemInstruction() }, ...contents.map((c: any) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts?.[0]?.text || '' }))];
      const r = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` }, body: JSON.stringify({ model: 'meta/llama-3.1-8b-instruct', messages, temperature: 0.4, max_tokens: 250 }) });
      if (r.ok) { const d = await r.json(); return res.status(200).json({ text: d.choices?.[0]?.message?.content || '' }); }
    } catch (e: any) { console.error('[chat] NVIDIA:', e.message); }
  }

  // ── OpenAI (fallback) ─────────────────────────────────────────────────────────
  if (process.env.OPENAI_API_KEY) {
    try {
      const messages = [{ role: 'system', content: getSystemInstruction() }, ...contents.map((c: any) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts?.[0]?.text || '' }))];
      const r = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.4, max_tokens: 250 }) });
      if (r.ok) { const d = await r.json(); return res.status(200).json({ text: d.choices?.[0]?.message?.content || '' }); }
    } catch (e: any) { console.error('[chat] OpenAI:', e.message); }
  }

  return res.status(500).json({ error: 'No AI backend configured.' });
}
