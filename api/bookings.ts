import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import { BOOKING_SLOTS } from '../shared/booking-validation.js';
import { authenticate } from './_lib/authenticate.js';
import { authorize } from './_lib/authorize.js';
import { createPendingBooking, cancelPendingBooking, confirmBooking, executePaidBookingOperation, createBookingRequest } from './_lib/bookings/booking-command-service.js';
import { acquireBookingHold, releaseBookingHold, resolveHoldTtlSeconds } from './_lib/bookings/hold-service.js';
import { effectiveBookingReadMode, readDataModelFlags } from './_lib/data/feature-flags.js';
import { assertBrowserBookingMutationDisabled } from './_lib/payments/rollout-gate.js';
import { getAdminFirestore } from './_lib/firebase-admin.js';
import { applyNoStore } from './_lib/http-policy.js';
import { HttpError, toHttpError } from './_lib/http-errors.js';
import { rejectUnknownKeys, requireEnum, requireIdempotencyKey, requireInteger, requireIsoDate, requireObject, requireResourceId, requireString } from './_lib/request-validation.js';

const ACTIONS = new Set([
  'request.create', 'hold.acquire', 'hold.release', 'booking.create_pending', 'booking.cancel',
  'booking.confirm', 'booking.assign', 'booking.start', 'booking.complete', 'booking.reschedule',
  'booking.list_own', 'booking.list_all', 'booking.list_assigned',
]);

function header(req: VercelRequest, name: string): string | undefined {
  const value = req.headers[name]; return Array.isArray(value) ? value[0] : value;
}

async function listOwn(uid: string) {
  const db = getAdminFirestore(); const flags = readDataModelFlags(); const readMode = effectiveBookingReadMode(flags);
  const legacy = async () => (await db.collection('users').doc(uid).collection('bookings').limit(100).get()).docs.map((doc) => ({ bookingId: doc.id, ...doc.data() }));
  const canonical = async () => (await db.collection('client_booking_views').doc(uid).collection('items').limit(100).get()).docs.map((doc) => ({ bookingId: doc.id, ...doc.data() }));
  if (readMode === 'canonical') return canonical();
  if (readMode === 'dual') {
    const merged = new Map((await legacy()).map((item) => [String(item.bookingId), item]));
    for (const item of await canonical()) merged.set(String(item.bookingId), item);
    return [...merged.values()];
  }
  const legacyItems = await legacy();
  if (readMode === 'shadow') {
    const canonicalItems = await canonical();
    if (JSON.stringify(legacyItems) !== JSON.stringify(canonicalItems)) await db.collection('booking_shadow_differences').add({ uid, legacyCount: legacyItems.length, canonicalCount: canonicalItems.length, createdAt: new Date() });
  }
  return legacyItems;
}

async function listAllOperations() {
  const db = getAdminFirestore(); const mode = effectiveBookingReadMode(readDataModelFlags());
  const legacy = async () => (await db.collection('reservas_index').limit(100).get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  const canonical = async () => (await db.collection('operations_booking_views').orderBy('date', 'desc').limit(100).get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  if (mode === 'canonical') return canonical();
  if (mode === 'dual') {
    const merged = new Map((await legacy()).map((item) => [String(item.id), item]));
    for (const item of await canonical()) merged.set(String(item.id), item);
    return [...merged.values()];
  }
  return legacy();
}

async function listAssigned(professionalUid: string) {
  const db = getAdminFirestore(); const mode = effectiveBookingReadMode(readDataModelFlags());
  const legacy = async () => (await db.collection('reservas_index').where('assignedEmployeeId', '==', professionalUid).limit(100).get()).docs.map((doc) => ({ id: doc.id, docId: doc.id, ...doc.data() }));
  const canonical = async () => (await db.collection('professional_booking_views').doc(professionalUid).collection('items').orderBy('date', 'desc').limit(100).get()).docs.map((doc) => ({ id: doc.id, docId: doc.id, ...doc.data() }));
  if (mode === 'canonical') return canonical();
  if (mode === 'dual') {
    const merged = new Map((await legacy()).map((item) => [String(item.id), item]));
    for (const item of await canonical()) merged.set(String(item.id), item);
    return [...merged.values()];
  }
  return legacy();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyNoStore(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    const identity = await authenticate(req); const body = requireObject(req.body); const action = requireString(body.action, 'action');
    if (!ACTIONS.has(action)) throw new HttpError(400, 'INVALID_ACTION', 'Invalid booking action');
    const requestId = header(req, 'x-request-id') ?? randomUUID();

    if (action === 'booking.list_own') {
      await authorize(identity, 'bookings.read_own'); return res.status(200).json({ items: await listOwn(identity.uid) });
    }
    if (action === 'booking.list_all') {
      await authorize(identity, 'bookings.read_all');
      return res.status(200).json({ items: await listAllOperations() });
    }
    if (action === 'booking.list_assigned') {
      await authorize(identity, 'bookings.read_assigned');
      return res.status(200).json({ items: await listAssigned(identity.uid) });
    }
    const flags = readDataModelFlags();
    if (flags.bookingWriteMode === 'disabled') throw new HttpError(503, 'CANONICAL_BOOKING_WRITES_DISABLED', 'Canonical booking writes are disabled');
    assertBrowserBookingMutationDisabled();
    const idempotencyKey = requireIdempotencyKey(header(req, 'idempotency-key') ?? body.idempotencyKey);
    if (action === 'request.create') {
      await authorize(identity, 'bookings.request_own');
      rejectUnknownKeys(body, ['action', 'idempotencyKey', 'residenceId', 'localDate', 'slot', 'catalogItemId', 'format', 'addonCodes']);
      const addonCodes: unknown[] | null = Array.isArray(body.addonCodes) ? body.addonCodes as unknown[] : null;
      if (!addonCodes || addonCodes.length > 20) throw new HttpError(400, 'INVALID_PAYLOAD', 'addonCodes is invalid');
      const result = await createBookingRequest({ clientUid: identity.uid, residenceId: requireResourceId(body.residenceId, 'residenceId'), localDate: requireIsoDate(body.localDate), slot: requireEnum(body.slot, 'slot', BOOKING_SLOTS), catalogItemId: requireResourceId(body.catalogItemId, 'catalogItemId'), format: requireEnum(body.format, 'format', ['half_day', 'full_day'] as const), addonCodes: addonCodes.map((item) => requireResourceId(item, 'addonCode')), idempotencyKey, requestId });
      return res.status(201).json(result);
    }
    if (action === 'hold.acquire') {
      await authorize(identity, 'bookings.request_own');
      if (flags.bookingHoldMode !== 'enforced') throw new HttpError(503, 'BOOKING_HOLDS_DISABLED', 'Booking holds are not enforced');
      const result = await acquireBookingHold({ requestId: requireResourceId(body.applicationId, 'applicationId'), clientUid: identity.uid, localDate: requireIsoDate(body.localDate), slot: requireEnum(body.slot, 'slot', BOOKING_SLOTS), expectedRequestVersion: requireInteger(body.expectedVersion, 'expectedVersion', 1, 1_000_000), ttlSeconds: resolveHoldTtlSeconds(), actorUid: identity.uid, idempotencyKey });
      return res.status(201).json(result);
    }
    if (action === 'hold.release') {
      await authorize(identity, 'bookings.request_own');
      await releaseBookingHold({ holdId: requireResourceId(body.holdId, 'holdId'), actorUid: identity.uid, clientUid: identity.uid, reason: 'client_cancelled' });
      return res.status(200).json({ ok: true });
    }
    if (action === 'booking.create_pending') {
      await authorize(identity, 'bookings.request_own');
      const result = await createPendingBooking({ clientUid: identity.uid, applicationId: requireResourceId(body.applicationId, 'applicationId'), expectedRequestVersion: requireInteger(body.expectedVersion, 'expectedVersion', 1, 1_000_000), quotedAmount: requireInteger(body.quotedAmount, 'quotedAmount', 1, 10_000_000), pricingVersion: requireString(body.pricingVersion, 'pricingVersion', { max: 80 }), idempotencyKey, requestId });
      return res.status(201).json(result);
    }
    if (action === 'booking.cancel') {
      const actor = await authorize(identity, ['bookings.request_own', 'bookings.manage'], { requirementMode: 'any' });
      const actorKind = actor.permissions.includes('bookings.manage') ? 'operations' as const : 'client' as const;
      const result = await cancelPendingBooking({ bookingId: requireResourceId(body.bookingId, 'bookingId'), actorUid: identity.uid, actorKind, expectedVersion: requireInteger(body.expectedVersion, 'expectedVersion', 1, 1_000_000), idempotencyKey, requestId, reason: requireString(body.reason, 'reason', { max: 300 }) });
      return res.status(200).json(result);
    }
    if (action === 'booking.confirm') {
      await authorize(identity, 'bookings.manage'); return confirmBooking();
    }
    if (['booking.assign', 'booking.start', 'booking.complete', 'booking.reschedule'].includes(action)) {
      await authorize(identity, ['bookings.manage', 'bookings.update_assigned_status'], { requirementMode: 'any' });
      return executePaidBookingOperation();
    }
    throw new HttpError(400, 'INVALID_ACTION', 'Invalid booking action');
  } catch (error) {
    const httpError = toHttpError(error); return res.status(httpError.status).json({ error: httpError.code, message: httpError.message });
  }
}
