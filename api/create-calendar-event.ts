import { createSign, randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { Firestore } from 'firebase-admin/firestore';

import { authorize, type AuthorizationRequirementMode, type AuthorizedActor } from './_lib/authorize.js';
import { authenticate, type AuthenticatedIdentity } from './_lib/authenticate.js';
import { getAdminFirestore } from './_lib/firebase-admin.js';
import { applyNoStore } from './_lib/http-policy.js';
import { HttpError, toHttpError } from './_lib/http-errors.js';
import { requireCanonicalApprovedPayment } from './_lib/payment-evidence.js';
import { enqueueVerifiedBookingEffect } from './_lib/payments/outbox-service.js';
import { withAuditedAdminAccess, type PrivilegedAccessDescriptor } from './_lib/audited-admin.js';
import {
  rejectUnknownKeys,
  requireClockTime,
  requireIdempotencyKey,
  requireIsoDate,
  requireObject,
  requireResourceId,
} from './_lib/request-validation.js';

interface CafeEventResult { id: string; htmlLink?: string }

export interface CalendarDependencies {
  authenticate(req: VercelRequest): Promise<AuthenticatedIdentity>;
  authorize(identity: AuthenticatedIdentity, permissions: Parameters<typeof authorize>[1], options?: { requirementMode?: AuthorizationRequirementMode }): Promise<AuthorizedActor>;
  getFirestore(): Firestore;
  createCafeEvent(details: {
    candidateName: string;
    whatsapp: string;
    date: string;
    time: string;
  }): Promise<CafeEventResult>;
  requirePaymentEvidence(bookingId: string): Promise<unknown>;
  enqueueBookingCalendar(input: { bookingId: string; actorUid: string; requestId: string }): Promise<{ jobId: string }>;
  auditAdminAccess?<T>(descriptor: PrivilegedAccessDescriptor, operation: () => Promise<T>): Promise<T>;
}

function generateServiceAccountJwt(clientEmail: string, privateKey: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1_000);
  const payload = Buffer.from(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3_600,
    iat: now,
  })).toString('base64url');
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(privateKey, 'base64url')}`;
}

async function createCafeEvent(details: {
  candidateName: string;
  whatsapp: string;
  date: string;
  time: string;
}): Promise<CafeEventResult> {
  const rawCredentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!rawCredentials || !calendarId) {
    throw new HttpError(503, 'CALENDAR_UNAVAILABLE', 'Calendar integration is unavailable');
  }
  let credentials: { private_key?: string; client_email?: string };
  try {
    credentials = JSON.parse(rawCredentials) as typeof credentials;
  } catch {
    throw new HttpError(503, 'CALENDAR_UNAVAILABLE', 'Calendar integration is unavailable');
  }
  if (!credentials.private_key || !credentials.client_email) {
    throw new HttpError(503, 'CALENDAR_UNAVAILABLE', 'Calendar integration is unavailable');
  }

  const assertion = generateServiceAccountJwt(
    credentials.client_email,
    credentials.private_key.replace(/\\n/g, '\n'),
  );
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!tokenResponse.ok) {
    throw new HttpError(502, 'CALENDAR_PROVIDER_ERROR', 'Calendar authentication failed');
  }
  const tokenPayload = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenPayload.access_token) {
    throw new HttpError(502, 'CALENDAR_PROVIDER_ERROR', 'Calendar authentication failed');
  }

  const start = new Date(`${details.date}T${details.time}:00-03:00`);
  const end = new Date(start.getTime() + 30 * 60_000);
  const eventResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `Café Virtual com a Pame — ${details.candidateName}`,
        description: `Entrevista de candidatura. WhatsApp: ${details.whatsapp}`,
        start: { dateTime: start.toISOString(), timeZone: 'America/Sao_Paulo' },
        end: { dateTime: end.toISOString(), timeZone: 'America/Sao_Paulo' },
      }),
    },
  );
  if (!eventResponse.ok) {
    throw new HttpError(502, 'CALENDAR_PROVIDER_ERROR', 'Calendar event creation failed');
  }
  const event = (await eventResponse.json()) as { id?: string; htmlLink?: string };
  if (!event.id) throw new HttpError(502, 'CALENDAR_PROVIDER_ERROR', 'Calendar returned no event ID');
  return { id: event.id, ...(event.htmlLink ? { htmlLink: event.htmlLink } : {}) };
}

const defaultDependencies: CalendarDependencies = {
  authenticate,
  authorize: (identity, permissions, options) => authorize(identity, permissions, options),
  getFirestore: getAdminFirestore,
  createCafeEvent,
  requirePaymentEvidence: (bookingId) => requireCanonicalApprovedPayment(bookingId),
  enqueueBookingCalendar: (input) => enqueueVerifiedBookingEffect({ ...input, kind: 'calendar.booking_upsert' }),
  auditAdminAccess: (descriptor, operation) => withAuditedAdminAccess(descriptor, operation),
};

export function createCalendarHandler(dependencies: CalendarDependencies = defaultDependencies) {
  return async function calendarHandler(req: VercelRequest, res: VercelResponse) {
    applyNoStore(res);
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
    }
    try {
      const identity = await dependencies.authenticate(req);
      const body = requireObject(req.body);
      rejectUnknownKeys(body, ['type', 'details']);
      const details = requireObject(body.details, 'details');

      if (body.type === 'booking') {
        await dependencies.authorize(identity, 'integrations.execute');
        rejectUnknownKeys(details, ['bookingId', 'idempotencyKey']);
        const bookingId = requireResourceId(details.bookingId, 'bookingId');
        requireIdempotencyKey(details.idempotencyKey);
        await dependencies.requirePaymentEvidence(bookingId);
        const queued = await dependencies.enqueueBookingCalendar({
          bookingId,
          actorUid: identity.uid,
          requestId: typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : String(details.idempotencyKey),
        });
        return res.status(202).json({ accepted: true, jobId: queued.jobId });
      }
      if (body.type !== 'cafe-virtual') {
        throw new HttpError(400, 'INVALID_PAYLOAD', 'Unsupported calendar event type');
      }

      rejectUnknownKeys(details, ['applicationId', 'date', 'time']);
      const applicationId = requireResourceId(details.applicationId, 'applicationId');
      const actor = await dependencies.authorize(identity, ['profile.candidate.manage_self', 'candidates.review'], { requirementMode: 'any' });
      const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : randomUUID();
      const audited = dependencies.auditAdminAccess ?? ((_descriptor, operation) => operation());
      const permission = actor.permissions.includes('candidates.review') ? 'candidates.review' : 'profile.candidate.manage_self';
      const applicationDocument = await audited({
        actorUid: actor.uid, permission, action: 'candidate.cafe.context.read', resourceType: 'candidate_application',
        resourceId: applicationId, reason: 'Schedule Cafe Virtual', requestId,
      }, () => dependencies.getFirestore().collection('candidate_applications').doc(applicationId).get());
      if (!applicationDocument.exists) {
        throw new HttpError(404, 'CANDIDATE_NOT_FOUND', 'Candidate application not found');
      }
      const candidate = applicationDocument.data() ?? {};
      const isOwner = candidate.candidateUid === identity.uid;
      if (!isOwner && (!actor.permissions.includes('candidates.review') || !actor.permissions.includes('integrations.execute'))) {
        throw new HttpError(403, 'PERMISSION_DENIED', 'Permission denied');
      }

      const date = requireIsoDate(details.date);
      const time = requireClockTime(details.time);
      if (date < new Date().toISOString().slice(0, 10)) {
        throw new HttpError(400, 'INVALID_PAYLOAD', 'Date must not be in the past');
      }

      if (candidate.state === 'approved' || candidate.state === 'rejected' || candidate.state === 'withdrawn') {
        throw new HttpError(409, 'CANDIDATE_STATE_INVALID', 'Candidate cannot schedule this interview');
      }

      const privateDocument = await audited({
        actorUid: actor.uid, permission, action: 'candidate.cafe.contact.read', resourceType: 'candidate_private',
        resourceId: applicationId, reason: 'Create authorized Cafe Virtual calendar event', requestId,
      }, () => dependencies.getFirestore().collection('candidate_private').doc(applicationId).get());
      if (!privateDocument.exists) throw new HttpError(409, 'CANDIDATE_PRIVATE_DATA_MISSING', 'Candidate private data requires reconciliation');
      const candidatePrivate = privateDocument.data() ?? {};
      const event = await dependencies.createCafeEvent({
        candidateName: typeof candidatePrivate.name === 'string' ? candidatePrivate.name : 'Candidata',
        whatsapp: typeof candidatePrivate.whatsapp === 'string' ? candidatePrivate.whatsapp : '',
        date,
        time,
      });
      await applicationDocument.ref.update({
        cafe: { state: 'scheduled', date, time, calendarEventId: event.id },
        updatedAt: new Date(),
      });
      await dependencies.getFirestore().collection('candidate_self_views').doc(String(candidate.candidateUid)).collection('applications').doc(applicationId).set({
        cafeState: 'scheduled', cafeDate: date, cafeTime: time, updatedAt: new Date(),
      }, { merge: true });
      return res.status(200).json({ success: true, calendarCreated: true, eventId: event.id });
    } catch (error) {
      const httpError = toHttpError(error);
      return res.status(httpError.status).json({ error: httpError.code, message: httpError.message });
    }
  };
}

export default createCalendarHandler();
