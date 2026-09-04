import { createHash, createSign } from 'node:crypto';
import { getAdminFirestore } from '../firebase-admin.js';
import { HttpError } from '../http-errors.js';
import { readDataModelFlags } from '../data/feature-flags.js';
import type { OutboxAdapters } from './outbox-service.js';

function allowed(env: Record<string, string | undefined>, key: string, target: string | undefined): void {
  const values = new Set((env[key] ?? '').split(',').map((item) => item.trim()).filter(Boolean));
  if (!target || !values.has(target)) throw new HttpError(503, 'EXTERNAL_EFFECT_SANDBOX_TARGET_REQUIRED', 'External sandbox target is not allowlisted');
}

/** A WhatsApp mock is permitted only in an isolated Vercel Preview sandbox. */
export function previewWhatsAppMockEnabled(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV === 'preview' && env.WHATSAPP_ADAPTER_MODE === 'mock';
}

async function calendarToken(raw: string, fetchImpl: typeof fetch): Promise<string> {
  let credentials: { client_email?: string; private_key?: string };
  try { credentials = JSON.parse(raw) as typeof credentials; } catch { throw new HttpError(503, 'CALENDAR_UNAVAILABLE', 'Calendar credentials are invalid'); }
  if (!credentials.client_email || !credentials.private_key) throw new HttpError(503, 'CALENDAR_UNAVAILABLE', 'Calendar credentials are invalid');
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url'); const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/calendar.events', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })).toString('base64url');
  const signer = createSign('RSA-SHA256'); signer.update(`${header}.${payload}`);
  const assertion = `${header}.${payload}.${signer.sign(credentials.private_key.replace(/\\n/g, '\n'), 'base64url')}`;
  const response = await fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const body = await response.json() as { access_token?: string }; if (!response.ok || !body.access_token) throw new HttpError(502, 'CALENDAR_PROVIDER_ERROR', 'Calendar authentication failed'); return body.access_token;
}

/** Deletes only a known event from the dedicated Preview R7 test calendar. */
export async function deleteR7TestCalendarEvent(input: { eventId: string; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch }): Promise<void> {
  const env = input.env ?? process.env; const fetchImpl = input.fetchImpl ?? fetch;
  if (env.VERCEL_ENV !== 'preview' || env.R7_TEST_MODE !== 'enabled' || !input.eventId) throw new HttpError(404, 'NOT_FOUND', 'Not found');
  const calendarId = env.GOOGLE_CALENDAR_ID;
  if (!calendarId || !env.GOOGLE_SERVICE_ACCOUNT_KEY) throw new HttpError(503, 'CALENDAR_UNAVAILABLE', 'Calendar integration is unavailable');
  allowed(env, 'EXTERNAL_EFFECTS_SANDBOX_CALENDAR_ALLOWLIST', calendarId);
  const token = await calendarToken(env.GOOGLE_SERVICE_ACCOUNT_KEY, fetchImpl);
  const response = await fetchImpl(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok && response.status !== 404) throw new HttpError(502, 'CALENDAR_PROVIDER_ERROR', 'Calendar event deletion failed');
}

/**
 * Returns only a status code for the dedicated Preview test calendar.
 *
 * `calendar.events` authorizes event operations, not `calendars.get` metadata.
 * Keep this diagnostic aligned with the adapter's minimum operational scope.
 */
export async function diagnoseR7TestCalendar(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): Promise<{ status: number; accessible: boolean }> {
  if (env.VERCEL_ENV !== 'preview' || env.R7_TEST_MODE !== 'enabled') throw new HttpError(404, 'NOT_FOUND', 'Not found');
  const calendarId = env.GOOGLE_CALENDAR_ID;
  if (!calendarId || !env.GOOGLE_SERVICE_ACCOUNT_KEY) throw new HttpError(503, 'CALENDAR_UNAVAILABLE', 'Calendar integration is unavailable');
  allowed(env, 'EXTERNAL_EFFECTS_SANDBOX_CALENDAR_ALLOWLIST', calendarId);
  const token = await calendarToken(env.GOOGLE_SERVICE_ACCOUNT_KEY, fetchImpl);
  const response = await fetchImpl(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?maxResults=1`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: response.status, accessible: response.ok };
}

export function createExternalEffectAdapter(env: Record<string, string | undefined> = process.env, fetchImpl: typeof fetch = fetch): OutboxAdapters {
  const mode = readDataModelFlags(env).externalEffectsMode;
  const mock = mode === 'mock' && Boolean(env.FIRESTORE_EMULATOR_HOST) && (env.GCLOUD_PROJECT === 'demo-metodo-pame' || env.FIREBASE_PROJECT_ID === 'demo-metodo-pame');
  if (mock) return { async execute(job) { return { providerReference: `mock_${createHash('sha256').update(String(job.dedupeKey)).digest('hex').slice(0, 24)}` }; } };
  if (!['sandbox', 'production'].includes(mode)) return { async execute() { throw new HttpError(503, 'EXTERNAL_EFFECT_ADAPTER_UNAVAILABLE', 'External effects are disabled'); } };
  return { async execute(job) {
    if (!['calendar.booking_upsert', 'email.booking_confirmed', 'email.professional_assigned', 'whatsapp.booking_event'].includes(String(job.kind))) throw new HttpError(503, 'EXTERNAL_EFFECT_KIND_PENDING_POLICY', 'This scheduled effect requires a policy before activation');
    const db = getAdminFirestore(); const booking = await db.collection('service_bookings').doc(String(job.bookingId)).get(); const privateOrder = await db.collection('order_private').doc(String(job.orderId)).get();
    if (!booking.exists) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found'); const contact = privateOrder.data() ?? {};
    if (job.kind === 'calendar.booking_upsert') {
      const calendarId = env.GOOGLE_CALENDAR_ID; if (!calendarId || !env.GOOGLE_SERVICE_ACCOUNT_KEY) throw new HttpError(503, 'CALENDAR_UNAVAILABLE', 'Calendar integration is unavailable'); if (mode === 'sandbox') allowed(env, 'EXTERNAL_EFFECTS_SANDBOX_CALENDAR_ALLOWLIST', calendarId);
      const token = await calendarToken(env.GOOGLE_SERVICE_ACCOUNT_KEY, fetchImpl); const schedule = booking.get('schedule') ?? {}; const start = new Date(`${String(schedule.localDate)}T09:00:00-03:00`); const end = new Date(start.getTime() + (schedule.slot === 'full_day' ? 8 : 4) * 3600000);
      const response = await fetchImpl(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ summary: job.r7Test === true ? 'R7 TEST — evento técnico' : 'Serviço Método Pame', start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' }, end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' }, extendedProperties: { private: { bookingId: booking.id, dedupeKey: String(job.dedupeKey), r7Test: job.r7Test === true ? 'true' : 'false' } } }) });
      const body = await response.json() as { id?: string }; if (!response.ok || !body.id) throw new HttpError(502, 'CALENDAR_PROVIDER_ERROR', 'Calendar event creation failed'); return { providerReference: `calendar:${body.id}` };
    }
    if (String(job.kind).startsWith('email.')) {
      const email = typeof contact.email === 'string' ? contact.email : undefined; if (mode === 'sandbox') allowed(env, 'EXTERNAL_EFFECTS_SANDBOX_EMAIL_ALLOWLIST', email); if (!email || !env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) throw new HttpError(503, 'EMAIL_UNAVAILABLE', 'Email integration is unavailable');
      const response = await fetchImpl('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [email], subject: 'Método Pame', html: '<p>Atualização do seu atendimento Método Pame.</p>', headers: { 'Idempotency-Key': String(job.dedupeKey) } }) });
      const body = await response.json() as { id?: string }; if (!response.ok || !body.id) throw new HttpError(502, 'EMAIL_PROVIDER_ERROR', 'Email delivery failed'); return { providerReference: `resend:${body.id}` };
    }
    const phone = typeof contact.phone === 'string' ? contact.phone : undefined; if (mode === 'sandbox') allowed(env, 'EXTERNAL_EFFECTS_SANDBOX_PHONE_ALLOWLIST', phone);
    if (mode === 'sandbox' && previewWhatsAppMockEnabled(env)) return { providerReference: `whatsapp_mock:${createHash('sha256').update(String(job.dedupeKey)).digest('hex').slice(0, 24)}` };
    if (!phone || !env.WHATSAPP_API_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) throw new HttpError(503, 'WHATSAPP_UNAVAILABLE', 'WhatsApp integration is unavailable');
    const response = await fetchImpl(`https://graph.facebook.com/v20.0/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: phone.replace(/\D/g, ''), type: 'text', text: { body: 'Atualização do seu atendimento Método Pame.' } }) });
    const body = await response.json() as { messages?: Array<{ id?: string }> }; const id = body.messages?.[0]?.id; if (!response.ok || !id) throw new HttpError(502, 'WHATSAPP_PROVIDER_ERROR', 'WhatsApp delivery failed'); return { providerReference: `whatsapp:${id}` };
  } };
}
