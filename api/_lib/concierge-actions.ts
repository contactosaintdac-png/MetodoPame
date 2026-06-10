/**
 * concierge-actions.ts
 * Funciones reales que el Concierge IA puede ejecutar via Gemini Function Calling.
 * Usa Firebase Admin SDK para acceso server-side sin restricciones de seguridad.
 */

import admin from 'firebase-admin';
import { Resend } from 'resend';

// ─── Inicialización Firebase Admin — LAZY (solo cuando se necesita) ───────────
// Si las credenciales no están configuradas, las funciones devuelven error graceful
// en lugar de crashear todo el módulo al importarlo.

let _db: admin.firestore.Firestore | null = null;

function getDb(): admin.firestore.Firestore {
  if (_db) return _db;

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error('Firebase Admin credentials not configured (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY missing in Vercel env)');
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

export interface ReservaIndex {
  uid: string;
  bookingId: string;
  nombre: string;
  nombre_lower: string;
  email: string;
  fecha: string;       // YYYY-MM-DD
  hora: string;        // HH:MM
  formato: string;     // 'completo' | 'meio'
  frecuencia: string;  // 'avulso' | 'mensal'
  estado: string;      // 'Confirmado' | 'Cancelado' | 'Completado' | 'Pendiente de Pago'
  empleada_nombre: string;
  empleada_email: string;
  empleada_id: string;
  precio: number;
  notas_especiales: string;
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

// ─── FUNCIÓN 1: Buscar reserva por nombre ─────────────────────────────────────

export async function buscarReserva(nombre: string): Promise<ToolResult> {
  try {
    const nombreLower = nombre.toLowerCase().trim();

    // Búsqueda exacta primero
    const exactQuery = await getDb().collection('reservas_index')
      .where('nombre_lower', '==', nombreLower)
      .where('estado', '!=', 'Cancelado')
      .limit(3)
      .get();

    if (!exactQuery.empty) {
      const reservas = exactQuery.docs.map(d => ({ id: d.id, ...d.data() }));
      return { success: true, data: { reservas, total: reservas.length } };
    }

    // Búsqueda parcial: buscar si el nombre_lower inicia con el texto
    const partialQuery = await getDb().collection('reservas_index')
      .where('nombre_lower', '>=', nombreLower)
      .where('nombre_lower', '<=', nombreLower + '\uf8ff')
      .where('estado', '!=', 'Cancelado')
      .limit(5)
      .get();

    if (!partialQuery.empty) {
      const reservas = partialQuery.docs.map(d => ({ id: d.id, ...d.data() }));
      return { success: true, data: { reservas, total: reservas.length } };
    }

    return {
      success: false,
      error: `No encontré ninguna reserva activa para "${nombre}". Por favor, verifique el nombre ingresado.`
    };
  } catch (err) {
    console.error('[buscarReserva]', err);
    return { success: false, error: 'Error interno al buscar la reserva.' };
  }
}

// ─── FUNCIÓN 2: Verificar disponibilidad ──────────────────────────────────────

export async function verificarDisponibilidad(fecha: string, hora?: string): Promise<ToolResult> {
  try {
    let queryRef = getDb().collection('reservas_index')
      .where('fecha', '==', fecha)
      .where('estado', '==', 'Confirmado');

    const snapshot = await queryRef.get();
    const reservasEnFecha = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (hora) {
      const conflictos = reservasEnFecha.filter((r: any) => r.hora === hora);
      if (conflictos.length > 0) {
        return {
          success: true,
          data: {
            disponible: false,
            fecha,
            hora,
            mensaje: `El horario ${hora} del ${fecha} ya está ocupado. Hay ${reservasEnFecha.length} servicio(s) ese día.`,
            reservas_en_fecha: reservasEnFecha.length
          }
        };
      }
    }

    return {
      success: true,
      data: {
        disponible: true,
        fecha,
        hora: hora || 'cualquier horario',
        mensaje: `El ${fecha}${hora ? ` a las ${hora}` : ''} tiene disponibilidad.`,
        reservas_en_fecha: reservasEnFecha.length
      }
    };
  } catch (err) {
    console.error('[verificarDisponibilidad]', err);
    return { success: false, error: 'Error al verificar disponibilidad.' };
  }
}

// ─── FUNCIÓN 3: Cambiar fecha de reserva ──────────────────────────────────────

export async function cambiarFechaReserva(
  bookingId: string,
  uid: string,
  nuevaFecha: string,
  nuevaHora?: string
): Promise<ToolResult> {
  try {
    const indexRef  = getDb().collection('reservas_index').doc(bookingId);
    const bookingRef = getDb().collection('users').doc(uid).collection('bookings').doc(bookingId);

    const [indexSnap, bookingSnap] = await Promise.all([indexRef.get(), bookingRef.get()]);

    if (!indexSnap.exists || !bookingSnap.exists) {
      return { success: false, error: 'No se encontró la reserva en la base de datos.' };
    }

    const indexData  = indexSnap.data() as ReservaIndex;
    const bookingData = bookingSnap.data()!;
    const fechaAnterior = indexData.fecha;
    const horaAnterior  = indexData.hora;

    const updatePayload: any = {
      fecha:     nuevaFecha,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (nuevaHora) updatePayload.hora = nuevaHora;

    // Actualizar ambas colecciones en paralelo
    await Promise.all([
      indexRef.update(updatePayload),
      bookingRef.update({
        date:      nuevaFecha,
        ...(nuevaHora ? { time: nuevaHora } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    ]);

    // Disparar notificaciones de email
    await enviarNotificacionAccion({
      accion: 'cambio_fecha',
      nombreCliente:  indexData.nombre,
      emailCliente:   indexData.email,
      fechaAnterior,
      horaAnterior,
      nuevaFecha,
      nuevaHora:      nuevaHora || indexData.hora,
      empleadaNombre: indexData.empleada_nombre,
      empleadaEmail:  indexData.empleada_email,
      formato:        indexData.formato,
      precio:         indexData.precio
    });

    return {
      success: true,
      data: {
        mensaje: `Reserva de ${indexData.nombre} actualizada: ${fechaAnterior} → ${nuevaFecha}${nuevaHora ? ` a las ${nuevaHora}` : ''}.`,
        bookingId,
        fechaAnterior,
        nuevaFecha,
        nuevaHora: nuevaHora || indexData.hora
      }
    };
  } catch (err) {
    console.error('[cambiarFechaReserva]', err);
    return { success: false, error: 'Error al actualizar la reserva.' };
  }
}

// ─── FUNCIÓN 4: Cancelar reserva ──────────────────────────────────────────────

export async function cancelarReserva(bookingId: string, uid: string): Promise<ToolResult> {
  try {
    const indexRef   = getDb().collection('reservas_index').doc(bookingId);
    const bookingRef = getDb().collection('users').doc(uid).collection('bookings').doc(bookingId);

    const indexSnap = await indexRef.get();
    if (!indexSnap.exists) {
      return { success: false, error: 'No se encontró la reserva.' };
    }

    const indexData = indexSnap.data() as ReservaIndex;

    await Promise.all([
      indexRef.update({
        estado:    'Cancelado',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }),
      bookingRef.update({
        status:    'Cancelado',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    ]);

    await enviarNotificacionAccion({
      accion:         'cancelacion',
      nombreCliente:  indexData.nombre,
      emailCliente:   indexData.email,
      fechaAnterior:  indexData.fecha,
      horaAnterior:   indexData.hora,
      empleadaNombre: indexData.empleada_nombre,
      empleadaEmail:  indexData.empleada_email,
      formato:        indexData.formato,
      precio:         indexData.precio
    });

    return {
      success: true,
      data: {
        mensaje: `La reserva de ${indexData.nombre} del ${indexData.fecha} fue cancelada correctamente.`,
        bookingId
      }
    };
  } catch (err) {
    console.error('[cancelarReserva]', err);
    return { success: false, error: 'Error al cancelar la reserva.' };
  }
}

// ─── FUNCIÓN 5: Obtener detalles de una reserva ───────────────────────────────

export async function obtenerReserva(bookingId: string): Promise<ToolResult> {
  try {
    const snap = await getDb().collection('reservas_index').doc(bookingId).get();
    if (!snap.exists) {
      return { success: false, error: 'No se encontró la reserva con ese ID.' };
    }
    return { success: true, data: { id: snap.id, ...snap.data() } };
  } catch (err) {
    console.error('[obtenerReserva]', err);
    return { success: false, error: 'Error al obtener la reserva.' };
  }
}

// ─── FUNCIÓN 6: Crear reserva nueva (Pendiente de Pago) ───────────────────────

export async function crearReserva(
  nombre: string,
  email: string,
  fecha: string,
  hora: string,
  formato: 'completo' | 'meio',
  frecuencia: 'avulso' | 'mensal',
  notasEspeciales?: string
): Promise<ToolResult> {
  try {
    // Determinar precio base según formato
    const precio = formato === 'completo' ? 450 : 350;

    // Crear documento en reservas_index (sin uid del cliente aún)
    const newDoc = await getDb().collection('reservas_index').add({
      uid:              'pendiente',
      bookingId:        '',
      nombre,
      nombre_lower:     nombre.toLowerCase().trim(),
      email,
      fecha,
      hora,
      formato,
      frecuencia,
      estado:           'Pendiente de Pago',
      empleada_nombre:  '',
      empleada_email:   '',
      empleada_id:      '',
      precio,
      notas_especiales: notasEspeciales || '',
      createdAt:        admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:        admin.firestore.FieldValue.serverTimestamp()
    });

    // Actualizar el doc con su propio ID como bookingId
    await newDoc.update({ bookingId: newDoc.id });

    await enviarNotificacionAccion({
      accion:        'nueva_reserva_pendiente',
      nombreCliente: nombre,
      emailCliente:  email,
      nuevaFecha:    fecha,
      nuevaHora:     hora,
      formato,
      precio,
      notas:         notasEspeciales
    });

    return {
      success: true,
      data: {
        mensaje: `Nueva reserva creada para ${nombre} el ${fecha} a las ${hora}. Estado: Pendiente de Pago. El equipo de Método Pame contactará al cliente para coordinar el pago.`,
        bookingId: newDoc.id
      }
    };
  } catch (err) {
    console.error('[crearReserva]', err);
    return { success: false, error: 'Error al crear la reserva.' };
  }
}

// ─── Notificaciones internas ──────────────────────────────────────────────────

interface NotificacionParams {
  accion: 'cambio_fecha' | 'cancelacion' | 'nueva_reserva_pendiente';
  nombreCliente: string;
  emailCliente: string;
  fechaAnterior?: string;
  horaAnterior?: string;
  nuevaFecha?: string;
  nuevaHora?: string;
  empleadaNombre?: string;
  empleadaEmail?: string;
  formato?: string;
  precio?: number;
  notas?: string;
}

async function enviarNotificacionAccion(params: NotificacionParams): Promise<void> {
  const {
    accion, nombreCliente, emailCliente,
    fechaAnterior, horaAnterior, nuevaFecha, nuevaHora,
    empleadaNombre, empleadaEmail, formato, precio, notas
  } = params;

  const accionLabel = accion === 'cambio_fecha'
    ? 'Cambio de Fecha via Concierge IA'
    : accion === 'cancelacion'
    ? 'Cancelación via Concierge IA'
    : 'Nueva Reserva — Pendiente de Pago';

  const detalleHtml = accion === 'cambio_fecha' ? `
    <tr><td style="color:#80737f;padding-right:20px;">Anterior:</td><td style="font-weight:600;">${fechaAnterior} ${horaAnterior || ''}</td></tr>
    <tr><td style="color:#80737f;padding-right:20px;">Nueva fecha:</td><td style="font-weight:700;color:#703081;">${nuevaFecha} ${nuevaHora || ''}</td></tr>
  ` : accion === 'cancelacion' ? `
    <tr><td style="color:#80737f;padding-right:20px;">Fecha cancelada:</td><td style="font-weight:600;color:#c0392b;">${fechaAnterior} ${horaAnterior || ''}</td></tr>
  ` : `
    <tr><td style="color:#80737f;padding-right:20px;">Fecha:</td><td style="font-weight:600;">${nuevaFecha} ${nuevaHora || ''}</td></tr>
    <tr><td style="color:#80737f;padding-right:20px;">Formato:</td><td style="font-weight:600;">${formato}</td></tr>
    <tr><td style="color:#80737f;padding-right:20px;">Precio base:</td><td style="font-weight:700;color:#703081;">R$ ${precio}</td></tr>
    ${notas ? `<tr><td style="color:#80737f;padding-right:20px;">Notas:</td><td style="font-weight:600;">${notas}</td></tr>` : ''}
  `;

  const adminHtml = `
    <div style="background-color:#fff7fd;padding:40px 20px;font-family:Manrope,Helvetica,Arial,sans-serif;color:#1e1a20;">
      <div style="max-width:600px;margin:0 auto;background-color:#f8f7f9;border-radius:12px;overflow:hidden;box-shadow:-4px -4px 12px rgba(255,255,255,0.8),4px 4px 12px rgba(226,217,230,1);">
        <div style="padding:40px;border-bottom:1px solid #efe5ee;text-align:center;">
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#561668;letter-spacing:2px;text-transform:uppercase;">MÉTODO PAME</h1>
          <div style="height:2px;width:40px;background-color:#703081;margin:16px auto 0;"></div>
          <p style="margin:8px 0 0;font-size:12px;color:#80737f;text-transform:uppercase;letter-spacing:1px;">🤖 Acción ejecutada por Concierge IA</p>
        </div>
        <div style="padding:40px;">
          <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#1e1a20;">${accionLabel}</h2>
          <div style="background-color:#f4ebf4;border-radius:8px;padding:24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#1e1a20;line-height:2.2;">
              <tr><td style="color:#80737f;padding-right:20px;width:130px;">Cliente:</td><td style="font-weight:600;">${nombreCliente}</td></tr>
              <tr><td style="color:#80737f;padding-right:20px;">Email:</td><td style="font-weight:600;">${emailCliente}</td></tr>
              ${empleadaNombre ? `<tr><td style="color:#80737f;padding-right:20px;">Especialista:</td><td style="font-weight:600;">${empleadaNombre}</td></tr>` : ''}
              ${detalleHtml}
            </table>
          </div>
        </div>
        <div style="background-color:#561668;padding:24px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;font-weight:600;color:#fcd7ff;letter-spacing:1px;text-transform:uppercase;">Sistema Concierge IA | MÉTODO PAME</p>
        </div>
      </div>
    </div>
  `;

  const clienteHtml = `
    <div style="background-color:#fff7fd;padding:40px 20px;font-family:Manrope,Helvetica,Arial,sans-serif;color:#1e1a20;">
      <div style="max-width:600px;margin:0 auto;background-color:#f8f7f9;border-radius:12px;overflow:hidden;box-shadow:-4px -4px 12px rgba(255,255,255,0.8),4px 4px 12px rgba(226,217,230,1);">
        <div style="padding:40px;border-bottom:1px solid #efe5ee;text-align:center;">
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#561668;letter-spacing:2px;text-transform:uppercase;">MÉTODO PAME</h1>
          <div style="height:2px;width:40px;background-color:#703081;margin:16px auto 0;"></div>
        </div>
        <div style="padding:40px;">
          <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;">Estimado/a ${nombreCliente},</h2>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#4e434e;">
            ${accion === 'cambio_fecha'
              ? `Su reserva ha sido reagendada con éxito al <strong>${nuevaFecha}${nuevaHora ? ` a las ${nuevaHora} hs` : ''}</strong>. Si tiene alguna consulta, nuestro Concierge está disponible.`
              : accion === 'cancelacion'
              ? `Su reserva del ${fechaAnterior} ha sido cancelada según su solicitud. Esperamos poder atenderle próximamente.`
              : `Hemos registrado su reserva para el <strong>${nuevaFecha}${nuevaHora ? ` a las ${nuevaHora} hs` : ''}</strong>. Nuestro equipo se pondrá en contacto con usted a la brevedad para coordinar el pago y confirmar todos los detalles.`
            }
          </p>
          ${empleadaNombre && accion === 'cambio_fecha' ? `<p style="margin:0 0 0;font-size:14px;color:#80737f;">Su especialista asignada es <strong>${empleadaNombre}</strong>.</p>` : ''}
        </div>
        <div style="background-color:#561668;padding:24px 40px;text-align:center;">
          <p style="margin:0;font-size:12px;font-weight:600;color:#fcd7ff;letter-spacing:1px;text-transform:uppercase;">Método Pame | Home Detail de Lujo</p>
        </div>
      </div>
    </div>
  `;

  const subjectAdmin = accion === 'cambio_fecha'
    ? `🤖 IA Reagendó: ${nombreCliente} → ${nuevaFecha}`
    : accion === 'cancelacion'
    ? `🤖 IA Canceló: ${nombreCliente} (${fechaAnterior})`
    : `🤖 IA Creó Reserva: ${nombreCliente} — ${nuevaFecha}`;

  const subjectCliente = accion === 'cambio_fecha'
    ? `Su reserva fue reagendada al ${nuevaFecha} — MÉTODO PAME`
    : accion === 'cancelacion'
    ? `Cancelación confirmada — MÉTODO PAME`
    : `Reserva registrada — Pendiente de Pago | MÉTODO PAME`;

  const promises: Promise<any>[] = [
    // Admin (Pame)
    resend.emails.send({ from: 'Método Pame <reservas@metodopame.com>', to: [PAME_EMAIL], subject: subjectAdmin, html: adminHtml }),
    // Dev (Saint Dac) — copia de auditoría
    resend.emails.send({ from: 'Método Pame <reservas@metodopame.com>', to: [DEV_EMAIL], subject: `[Auditoría] ${subjectAdmin}`, html: adminHtml }),
    // Cliente
    resend.emails.send({ from: 'Método Pame <reservas@metodopame.com>', to: [emailCliente], subject: subjectCliente, html: clienteHtml }),
  ];

  // Empleada — solo si hay email y la acción la involucra
  if (empleadaEmail && (accion === 'cambio_fecha' || accion === 'cancelacion')) {
    const empleadaHtml = `
      <div style="background-color:#fff7fd;padding:40px 20px;font-family:Manrope,Helvetica,Arial,sans-serif;color:#1e1a20;">
        <div style="max-width:600px;margin:0 auto;background-color:#f8f7f9;border-radius:12px;overflow:hidden;">
          <div style="padding:32px;border-bottom:1px solid #efe5ee;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:800;color:#561668;letter-spacing:2px;">MÉTODO PAME</h1>
          </div>
          <div style="padding:32px;">
            <h2 style="margin:0 0 16px;font-size:18px;">Hola, ${empleadaNombre}.</h2>
            <p style="font-size:14px;line-height:1.7;color:#4e434e;">
              ${accion === 'cambio_fecha'
                ? `Tu servicio con <strong>${nombreCliente}</strong> fue reagendado: <strong>${fechaAnterior}</strong> → <strong>${nuevaFecha}${nuevaHora ? ` a las ${nuevaHora}` : ''}</strong>.`
                : `El servicio con <strong>${nombreCliente}</strong> del <strong>${fechaAnterior}</strong> fue cancelado. Tu agenda fue actualizada.`
              }
            </p>
          </div>
          <div style="background-color:#561668;padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:11px;font-weight:600;color:#fcd7ff;letter-spacing:1px;text-transform:uppercase;">Padrão de Qualidade Método Pame</p>
          </div>
        </div>
      </div>
    `;
    promises.push(
      resend.emails.send({
        from: 'Método Pame <reservas@metodopame.com>',
        to: [empleadaEmail],
        subject: accion === 'cambio_fecha' ? `Actualización de agenda: ${nombreCliente}` : `Servicio cancelado: ${nombreCliente}`,
        html: empleadaHtml
      })
    );
  }

  await Promise.allSettled(promises);
}
