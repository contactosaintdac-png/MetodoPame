import { randomUUID } from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { isLogicalHoldActive, slotSegments, type BookingSlot } from '../../../shared/booking-domain.js';
import type { ProfessionalLifecycle } from '../../../shared/professional-domain.js';
import { canReceiveServices } from '../../../shared/professional-domain.js';
import { getAdminFirestore } from '../firebase-admin.js';
import { writeBookingProjections } from '../data/projection-writer.js';
import { HttpError } from '../http-errors.js';
import { commandPayloadHash, commandReceiptId } from './idempotency.js';
import { mirrorCanonicalBookingToLegacy } from './legacy-mirror.js';

const LOCAL_PROJECT_ID = 'demo-metodo-pame';

export interface AcquireHoldInput {
  requestId: string;
  clientUid: string;
  localDate: string;
  slot: BookingSlot;
  expectedRequestVersion: number;
  ttlSeconds: number;
  idempotencyKey: string;
  actorUid: string;
  now?: Date;
  candidateProfessionalUids?: readonly string[];
}

export interface AcquiredHold {
  holdId: string;
  professionalUid: string;
  expiresAt: Date;
  segments: readonly ('morning' | 'afternoon')[];
}

export function resolveHoldTtlSeconds(env: Record<string, string | undefined> = process.env): number {
  const configured = Number(env.BOOKING_HOLD_TTL_SECONDS);
  if (!Number.isInteger(configured) || configured < 60 || configured > 86_400) {
    throw new HttpError(503, 'HOLD_TTL_NOT_CONFIGURED', 'A valid hold TTL must be configured');
  }
  return configured;
}

export function capacityLockId(professionalUid: string, localDate: string, segment: 'morning' | 'afternoon'): string {
  return `${professionalUid}_${localDate}_${segment}`;
}

export function assertEmulatorOnlyApply(env: Record<string, string | undefined> = process.env): void {
  const projectId = env.GCLOUD_PROJECT ?? env.FIREBASE_PROJECT_ID;
  if (!env.FIRESTORE_EMULATOR_HOST || projectId !== LOCAL_PROJECT_ID) {
    throw new Error('Booking hold mutation is restricted to the Método Pame local Emulator during F0.5');
  }
}

function lockIsUnavailable(data: FirebaseFirestore.DocumentData, now: Date): boolean {
  if (data.kind === 'booking') return true;
  if (data.kind !== 'hold' || !data.expiresAt) return false;
  return isLogicalHoldActive({ state: 'active', expiresAt: data.expiresAt }, now);
}

async function discoverCandidates(db: Firestore): Promise<string[]> {
  const snapshot = await db.collection('professional_capacity')
    .where('eligibleForService', '==', true)
    .orderBy('assignmentPriority.order', 'asc')
    .get();
  return snapshot.docs.map((document) => document.id);
}

export async function acquireBookingHold(
  input: AcquireHoldInput,
  db: Firestore = getAdminFirestore(),
  options: { emulatorGuard?: boolean; holdId?: string } = {},
): Promise<AcquiredHold> {
  if (options.emulatorGuard !== false) assertEmulatorOnlyApply();
  const nowDate = input.now ?? new Date();
  const expiresAt = new Date(nowDate.getTime() + input.ttlSeconds * 1000);
  const segments = slotSegments(input.slot);
  const candidates = input.candidateProfessionalUids?.length
    ? [...input.candidateProfessionalUids]
    : await discoverCandidates(db);
  if (candidates.length === 0) throw new HttpError(409, 'NO_ELIGIBLE_PROFESSIONAL', 'No eligible professional is available');

  for (const professionalUid of candidates) {
    const holdId = options.holdId ?? randomUUID();
    try {
      const result = await db.runTransaction(async (tx) => {
        const requestRef = db.collection('booking_requests').doc(input.requestId);
        const professionalRef = db.collection('professionals').doc(professionalUid);
        const lockRefs = segments.map((segment) => db.collection('capacity_slot_locks').doc(capacityLockId(professionalUid, input.localDate, segment)));
        const receiptRef = db.collection('booking_command_receipts').doc(commandReceiptId(input.actorUid, 'booking_hold.acquire', input.idempotencyKey));
        const [request, professional, receipt, ...locks] = await tx.getAll(requestRef, professionalRef, receiptRef, ...lockRefs);
        const payloadHash = commandPayloadHash({ requestId: input.requestId, clientUid: input.clientUid, localDate: input.localDate, slot: input.slot, expectedRequestVersion: input.expectedRequestVersion, ttlSeconds: input.ttlSeconds });
        if (receipt.exists) {
          if (receipt.get('payloadHash') !== payloadHash) throw new HttpError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used with a different payload');
          const replay = receipt.get('result') as { holdId: string; professionalUid: string; expiresAt: string; segments: ('morning' | 'afternoon')[] };
          return { ...replay, expiresAt: new Date(replay.expiresAt) };
        }
        if (!request.exists || request.get('clientUid') !== input.clientUid) throw new HttpError(404, 'BOOKING_REQUEST_NOT_FOUND', 'Booking request not found');
        if (request.get('version') !== input.expectedRequestVersion) throw new HttpError(409, 'VERSION_CONFLICT', 'Booking request changed');
        if (!['submitted', 'held'].includes(String(request.get('state')))) throw new HttpError(409, 'BOOKING_REQUEST_STATE_INVALID', 'Booking request cannot acquire a hold');
        if (!professional.exists || !canReceiveServices(professional.get('lifecycle') as ProfessionalLifecycle)) {
          throw new HttpError(409, 'PROFESSIONAL_NOT_ELIGIBLE', 'Professional is not currently eligible');
        }
        if (locks.some((lock) => lock.exists && lockIsUnavailable(lock.data()!, nowDate))) {
          throw new HttpError(409, 'SLOT_UNAVAILABLE', 'Capacity slot is unavailable');
        }

        const holdRef = db.collection('booking_holds').doc(holdId);
        const serverNow = Timestamp.fromDate(nowDate);
        tx.create(holdRef, {
          schemaVersion: 1, version: 1, requestId: input.requestId, clientUid: input.clientUid,
          professionalUid, localDate: input.localDate, slot: input.slot, segments: [...segments],
          state: 'active', expiresAt: Timestamp.fromDate(expiresAt), createdAt: serverNow, updatedAt: serverNow,
        });
        lockRefs.forEach((lockRef, index) => tx.set(lockRef, {
          schemaVersion: 1, professionalUid, localDate: input.localDate, segment: segments[index],
          kind: 'hold', ownerId: holdId, expiresAt: Timestamp.fromDate(expiresAt), createdAt: serverNow, updatedAt: serverNow,
        }));
        tx.update(requestRef, { state: 'held', holdId, version: input.expectedRequestVersion + 1, updatedAt: serverNow });
        tx.create(db.collection('audit_log').doc(), {
          actorUid: input.actorUid, action: 'booking_hold.acquired', target: `booking_holds/${holdId}`,
          metadata: { requestId: input.requestId, professionalUid, localDate: input.localDate, slot: input.slot }, createdAt: serverNow,
        });
        const commandResult = { holdId, professionalUid, expiresAt: expiresAt.toISOString(), segments: [...segments] };
        tx.create(receiptRef, { schemaVersion: 1, actorUid: input.actorUid, action: 'booking_hold.acquire', idempotencyKey: input.idempotencyKey, payloadHash, result: commandResult, createdAt: serverNow });
        return { holdId, professionalUid, expiresAt, segments };
      });
      return result;
    } catch (error) {
      if (error instanceof HttpError && ['SLOT_UNAVAILABLE', 'PROFESSIONAL_NOT_ELIGIBLE'].includes(error.code)) continue;
      throw error;
    }
  }
  throw new HttpError(409, 'SLOT_UNAVAILABLE', 'Capacity slot is unavailable');
}

export async function releaseBookingHold(input: {
  holdId: string;
  actorUid: string;
  clientUid?: string;
  reason: 'client_cancelled' | 'replaced' | 'expired' | 'operations_release';
  now?: Date;
}, db: Firestore = getAdminFirestore(), options: { emulatorGuard?: boolean } = {}): Promise<void> {
  if (options.emulatorGuard !== false) assertEmulatorOnlyApply();
  const nowDate = input.now ?? new Date();
  await db.runTransaction(async (tx) => {
    const holdRef = db.collection('booking_holds').doc(input.holdId);
    const hold = await tx.get(holdRef);
    if (!hold.exists) throw new HttpError(404, 'BOOKING_HOLD_NOT_FOUND', 'Booking hold not found');
    if (input.clientUid && hold.get('clientUid') !== input.clientUid) throw new HttpError(403, 'BOOKING_HOLD_ACCESS_DENIED', 'Booking hold access denied');
    if (hold.get('state') !== 'active') return;
    const requestRef = db.collection('booking_requests').doc(String(hold.get('requestId')));
    const request = await tx.get(requestRef);
    const bookingRef = request.exists && request.get('state') === 'converted' && request.get('bookingId')
      ? db.collection('service_bookings').doc(String(request.get('bookingId'))) : null;
    const booking = bookingRef ? await tx.get(bookingRef) : null;
    const segments = hold.get('segments') as ('morning' | 'afternoon')[];
    const professionalUid = String(hold.get('professionalUid'));
    const localDate = String(hold.get('localDate'));
    const lockRefs = segments.map((segment) => db.collection('capacity_slot_locks').doc(capacityLockId(professionalUid, localDate, segment)));
    const locks = await tx.getAll(...lockRefs);
    const serverNow = Timestamp.fromDate(nowDate);
    tx.update(holdRef, { state: input.reason === 'expired' ? 'expired' : 'released', version: Number(hold.get('version')) + 1, releaseReason: input.reason, updatedAt: serverNow });
    locks.forEach((lock, index) => {
      if (lock.exists && lock.get('kind') === 'hold' && lock.get('ownerId') === input.holdId) tx.delete(lockRefs[index]);
    });
    if (request.exists && request.get('state') === 'held') {
      tx.update(requestRef, { state: 'submitted', holdId: null, version: Number(request.get('version')) + 1, updatedAt: serverNow });
    }
    if (input.reason === 'expired' && bookingRef && booking?.exists && booking.get('state') === 'pending_confirmation') {
      tx.update(bookingRef, { state: 'expired', version: Number(booking.get('version')) + 1, updatedAt: serverNow });
      const schedule = booking.get('schedule') ?? {}; const service = booking.get('service') ?? {}; const commercial = booking.get('commercialSnapshot') ?? {}; const assignment = booking.get('assignment') ?? {};
      const projection = {
        id: booking.id, clientUid: String(booking.get('clientUid')), date: String(schedule.localDate ?? ''), shift: String(schedule.slot ?? ''),
        service: String(service.catalogItemId ?? 'Serviço residencial'), status: 'expired', amount: Number(commercial.quotedAmount ?? 0),
        currency: 'BRL', paymentState: String(booking.get('payment.state') ?? 'unverified'),
        ...(assignment.professionalUid ? { assignedProfessionalUid: String(assignment.professionalUid) } : {}), assignmentState: assignment.state,
      };
      writeBookingProjections(tx, db, projection); mirrorCanonicalBookingToLegacy(tx, db, projection);
    }
    tx.create(db.collection('audit_log').doc(), { actorUid: input.actorUid, action: 'booking_hold.released', target: `booking_holds/${input.holdId}`, metadata: { reason: input.reason }, createdAt: serverNow });
  });
}

export async function expireDueBookingHolds(
  input: { actorUid: string; now?: Date; limit?: number },
  db: Firestore = getAdminFirestore(),
  options: { emulatorGuard?: boolean } = {},
): Promise<{ expired: number }> {
  if (options.emulatorGuard !== false) assertEmulatorOnlyApply();
  const now = input.now ?? new Date();
  const snapshot = await db.collection('booking_holds')
    .where('state', '==', 'active')
    .where('expiresAt', '<=', Timestamp.fromDate(now))
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 500))
    .get();
  let expired = 0;
  for (const document of snapshot.docs) {
    await releaseBookingHold({ holdId: document.id, actorUid: input.actorUid, reason: 'expired', now }, db, options);
    expired += 1;
  }
  return { expired };
}
