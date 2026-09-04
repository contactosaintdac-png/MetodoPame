import { randomUUID } from 'node:crypto';
import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';

import { bookingTransitionError, isLogicalHoldActive, type BookingSlot } from '../../../shared/booking-domain.js';
import { getAdminFirestore } from '../firebase-admin.js';
import { HttpError } from '../http-errors.js';
import { writeBookingProjections } from '../data/projection-writer.js';
import { assertEmulatorOnlyApply, capacityLockId } from './hold-service.js';
import { runIdempotentCommand } from './idempotency.js';
import { mirrorCanonicalBookingToLegacy } from './legacy-mirror.js';

function auditAndEvent(input: {
  db: Firestore; tx: Transaction; bookingId: string; actorUid: string; action: string;
  requestId: string; idempotencyKey: string; metadata?: Record<string, unknown>; now: Timestamp;
}) {
  input.tx.create(input.db.collection('booking_events').doc(), {
    schemaVersion: 1, bookingId: input.bookingId, actorUid: input.actorUid,
    action: input.action, requestId: input.requestId, idempotencyKey: input.idempotencyKey,
    metadata: input.metadata ?? {}, createdAt: input.now,
  });
  input.tx.create(input.db.collection('audit_log').doc(), {
    actorUid: input.actorUid, action: input.action, target: `service_bookings/${input.bookingId}`,
    metadata: { requestId: input.requestId, ...input.metadata }, createdAt: input.now,
  });
}

export async function createBookingRequest(input: {
  clientUid: string; residenceId: string; localDate: string; slot: BookingSlot;
  catalogItemId: string; format: 'half_day' | 'full_day'; addonCodes: string[];
  idempotencyKey: string; requestId: string; now?: Date;
}, db: Firestore = getAdminFirestore(), options: { emulatorGuard?: boolean; applicationId?: string } = {}) {
  if (options.emulatorGuard !== false) assertEmulatorOnlyApply();
  const applicationId = options.applicationId ?? randomUUID();
  const now = Timestamp.fromDate(input.now ?? new Date());
  return runIdempotentCommand({ db, actorUid: input.clientUid, action: 'booking_request.create', idempotencyKey: input.idempotencyKey, payload: input,
    execute: async (tx) => {
      const residence = await tx.get(db.collection('residences').doc(input.residenceId));
      if (!residence.exists || residence.get('clientUid') !== input.clientUid) throw new HttpError(404, 'RESIDENCE_NOT_FOUND', 'Residence not found');
      const ref = db.collection('booking_requests').doc(applicationId);
      tx.create(ref, {
        schemaVersion: 1, version: 1, clientUid: input.clientUid, residenceId: input.residenceId,
        state: 'submitted', requestedSchedule: { timezone: 'America/Sao_Paulo', localDate: input.localDate, slot: input.slot },
        requestedService: { catalogItemId: input.catalogItemId, format: input.format, addonCodes: input.addonCodes },
        source: { kind: 'native', references: [] }, createdAt: now, updatedAt: now,
      });
      tx.create(db.collection('audit_log').doc(), { actorUid: input.clientUid, action: 'booking_request.created', target: `booking_requests/${applicationId}`, metadata: { requestId: input.requestId }, createdAt: now });
      return { applicationId, version: 1, state: 'submitted' };
    },
  });
}

export async function createPendingBooking(input: {
  clientUid: string; applicationId: string; expectedRequestVersion: number;
  quotedAmount: number; pricingVersion: string; idempotencyKey: string; requestId: string; now?: Date;
}, db: Firestore = getAdminFirestore(), options: { emulatorGuard?: boolean; bookingId?: string } = {}) {
  if (options.emulatorGuard !== false) assertEmulatorOnlyApply();
  const bookingId = options.bookingId ?? randomUUID();
  const nowDate = input.now ?? new Date(); const now = Timestamp.fromDate(nowDate);
  return runIdempotentCommand({ db, actorUid: input.clientUid, action: 'booking.create_pending', idempotencyKey: input.idempotencyKey, payload: input,
    execute: async (tx) => {
      const requestRef = db.collection('booking_requests').doc(input.applicationId);
      const request = await tx.get(requestRef);
      if (!request.exists || request.get('clientUid') !== input.clientUid) throw new HttpError(404, 'BOOKING_REQUEST_NOT_FOUND', 'Booking request not found');
      if (request.get('version') !== input.expectedRequestVersion) throw new HttpError(409, 'VERSION_CONFLICT', 'Booking request changed');
      if (request.get('state') !== 'held' || !request.get('holdId')) throw new HttpError(409, 'ACTIVE_HOLD_REQUIRED', 'An active hold is required');
      const hold = await tx.get(db.collection('booking_holds').doc(String(request.get('holdId'))));
      if (!hold.exists || !isLogicalHoldActive({ state: hold.get('state'), expiresAt: hold.get('expiresAt') }, nowDate)) throw new HttpError(409, 'ACTIVE_HOLD_REQUIRED', 'An active hold is required');
      const schedule = request.get('requestedSchedule'); const service = request.get('requestedService');
      tx.create(db.collection('service_bookings').doc(bookingId), {
        schemaVersion: 1, version: 1, clientUid: input.clientUid, residenceId: request.get('residenceId'), requestId: input.applicationId,
        state: 'pending_confirmation', schedule: { ...schedule, revision: 1 }, service,
        commercialSnapshot: { quotedAmount: input.quotedAmount, currency: 'BRL', pricingVersion: input.pricingVersion },
        payment: { state: 'unverified' },
        assignment: { state: 'provisional', professionalUid: hold.get('professionalUid'), revision: 1 },
        holdId: hold.id, source: { kind: 'native', references: [] }, createdAt: now, updatedAt: now,
      });
      const projection = {
        id: bookingId, clientUid: input.clientUid, date: String(schedule.localDate), shift: String(schedule.slot),
        service: String(service.catalogItemId), status: 'pending_confirmation', amount: input.quotedAmount,
        currency: 'BRL', paymentState: 'unverified', assignedProfessionalUid: String(hold.get('professionalUid')),
        assignmentState: 'provisional' as const,
      };
      writeBookingProjections(tx, db, projection);
      mirrorCanonicalBookingToLegacy(tx, db, projection);
      tx.update(requestRef, { state: 'converted', bookingId, version: input.expectedRequestVersion + 1, updatedAt: now });
      auditAndEvent({ db, tx, bookingId, actorUid: input.clientUid, action: 'booking.pending_created', requestId: input.requestId, idempotencyKey: input.idempotencyKey, now });
      return { bookingId, version: 1, state: 'pending_confirmation', paymentState: 'unverified' };
    },
  });
}

export async function cancelPendingBooking(input: {
  bookingId: string; actorUid: string; actorKind: 'client' | 'operations'; expectedVersion: number;
  idempotencyKey: string; requestId: string; reason: string; now?: Date;
}, db: Firestore = getAdminFirestore(), options: { emulatorGuard?: boolean } = {}) {
  if (options.emulatorGuard !== false) assertEmulatorOnlyApply();
  const now = Timestamp.fromDate(input.now ?? new Date());
  return runIdempotentCommand({ db, actorUid: input.actorUid, action: 'booking.cancel', idempotencyKey: input.idempotencyKey, payload: input,
    execute: async (tx) => {
      const bookingRef = db.collection('service_bookings').doc(input.bookingId); const booking = await tx.get(bookingRef);
      if (!booking.exists) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
      if (booking.get('version') !== input.expectedVersion) throw new HttpError(409, 'VERSION_CONFLICT', 'Booking changed');
      if (input.actorKind === 'client' && booking.get('clientUid') !== input.actorUid) throw new HttpError(403, 'BOOKING_ACCESS_DENIED', 'Booking access denied');
      const error = bookingTransitionError(booking.get('state'), 'cancelled', { actor: input.actorKind, paymentApproved: false, hasActiveHold: true, hasAssignedProfessional: Boolean(booking.get('assignment.professionalUid')) });
      if (error) throw new HttpError(409, error, 'Booking transition is not allowed');
      const holdRef = db.collection('booking_holds').doc(String(booking.get('holdId'))); const hold = await tx.get(holdRef);
      const lockRefs = hold.exists ? (hold.get('segments') as ('morning' | 'afternoon')[]).map((segment) => db.collection('capacity_slot_locks').doc(capacityLockId(String(hold.get('professionalUid')), String(hold.get('localDate')), segment))) : [];
      const locks = lockRefs.length ? await tx.getAll(...lockRefs) : [];
      tx.update(bookingRef, { state: 'cancelled', cancellation: { reason: input.reason, actorUid: input.actorUid }, version: input.expectedVersion + 1, updatedAt: now });
      const schedule = booking.get('schedule') ?? {}; const service = booking.get('service') ?? {}; const commercial = booking.get('commercialSnapshot') ?? {}; const assignment = booking.get('assignment') ?? {};
      const projection = {
        id: input.bookingId, clientUid: String(booking.get('clientUid')), date: String(schedule.localDate ?? ''), shift: String(schedule.slot ?? ''),
        service: String(service.catalogItemId ?? 'Serviço residencial'), status: 'cancelled', amount: Number(commercial.quotedAmount ?? 0),
        currency: 'BRL', paymentState: String(booking.get('payment.state') ?? 'unverified'),
        ...(assignment.professionalUid ? { assignedProfessionalUid: String(assignment.professionalUid) } : {}),
        assignmentState: assignment.state,
      };
      writeBookingProjections(tx, db, projection);
      mirrorCanonicalBookingToLegacy(tx, db, projection);
      if (hold.exists && hold.get('state') === 'active') tx.update(holdRef, { state: 'released', releaseReason: 'booking_cancelled', version: Number(hold.get('version')) + 1, updatedAt: now });
      locks.forEach((lock, index) => { if (lock.exists && lock.get('kind') === 'hold' && lock.get('ownerId') === hold.id) tx.delete(lockRefs[index]); });
      auditAndEvent({ db, tx, bookingId: input.bookingId, actorUid: input.actorUid, action: 'booking.cancelled', requestId: input.requestId, idempotencyKey: input.idempotencyKey, metadata: { reason: input.reason }, now });
      return { bookingId: input.bookingId, version: input.expectedVersion + 1, state: 'cancelled' };
    },
  });
}

export function confirmBooking(): never {
  throw new HttpError(403, 'PAYMENT_EVENT_REQUIRED', 'Bookings are confirmed only by verified payment events');
}

export function executePaidBookingOperation(): never {
  throw new HttpError(503, 'PAID_BOOKING_COMMAND_NOT_IMPLEMENTED', 'This booking command is not available yet');
}
