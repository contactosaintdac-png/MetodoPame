import { createHash } from 'node:crypto';
import { Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';

import type { OutboxJobRecord } from '../../../shared/payment-contracts.js';
import { getAdminFirestore } from '../firebase-admin.js';
import { HttpError } from '../http-errors.js';

export type OutboxKind = OutboxJobRecord['kind'];

export const CONFIRMATION_OUTBOX_KINDS: readonly OutboxKind[] = [
  'calendar.booking_upsert',
  'email.booking_confirmed',
  'email.professional_assigned',
  'whatsapp.booking_event',
  'booking.reminder_schedule',
  'booking.address_reveal_schedule',
];

export function outboxJobId(bookingId: string, kind: OutboxKind, payloadVersion = 1): string {
  return createHash('sha256').update(`${bookingId}:${kind}:v${payloadVersion}`).digest('hex');
}

export function enqueueBookingOutbox(
  tx: Transaction,
  db: Firestore,
  input: { bookingId: string; orderId: string; now: Timestamp; kinds?: readonly OutboxKind[] },
): void {
  for (const kind of input.kinds ?? CONFIRMATION_OUTBOX_KINDS) {
    const id = outboxJobId(input.bookingId, kind);
    tx.set(db.collection('outbox_jobs').doc(id), {
      schemaVersion: 1, state: 'pending', kind, bookingId: input.bookingId, orderId: input.orderId,
      dedupeKey: id, payloadVersion: 1, attempts: 0, nextAttemptAt: input.now,
      createdAt: input.now, updatedAt: input.now,
    });
  }
}

export async function enqueueVerifiedBookingEffect(input: {
  bookingId: string;
  kind: OutboxKind;
  actorUid: string;
  requestId: string;
  now?: Date;
}, db: Firestore = getAdminFirestore()): Promise<{ jobId: string }> {
  const nowDate = input.now ?? new Date();
  const now = Timestamp.fromDate(nowDate);
  return db.runTransaction(async (tx) => {
    const bookingRef = db.collection('service_bookings').doc(input.bookingId);
    const jobId = outboxJobId(input.bookingId, input.kind);
    const jobRef = db.collection('outbox_jobs').doc(jobId);
    const [booking, existingJob] = await tx.getAll(bookingRef, jobRef);
    if (!booking.exists) throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    if (booking.get('state') !== 'confirmed' || booking.get('payment.state') !== 'approved' || !booking.get('payment.orderId')) {
      throw new HttpError(409, 'PAYMENT_EVIDENCE_REQUIRED', 'Verified payment is required');
    }
    if (existingJob.exists) return { jobId };
    tx.create(jobRef, {
      schemaVersion: 1, state: 'pending', kind: input.kind, bookingId: input.bookingId,
      orderId: String(booking.get('payment.orderId')), dedupeKey: jobId, payloadVersion: 1,
      attempts: 0, nextAttemptAt: now, createdAt: now, updatedAt: now,
    });
    tx.create(db.collection('audit_log').doc(), {
      actorUid: input.actorUid, action: 'outbox.effect.enqueued', target: `outbox_jobs/${jobId}`,
      metadata: { bookingId: input.bookingId, kind: input.kind, requestId: input.requestId }, createdAt: now,
    });
    return { jobId };
  });
}

export interface OutboxAdapters {
  execute(job: FirebaseFirestore.DocumentData): Promise<{ providerReference: string }>;
}

export async function processOutboxJobs(input: {
  workerId: string;
  limit?: number;
  now?: Date;
  adapters: OutboxAdapters;
}, db: Firestore = getAdminFirestore()): Promise<{ succeeded: number; retryable: number; deadLetter: number }> {
  const nowDate = input.now ?? new Date();
  const due = await db.collection('outbox_jobs').where('state', 'in', ['pending', 'retryable'])
    .where('nextAttemptAt', '<=', Timestamp.fromDate(nowDate)).orderBy('nextAttemptAt', 'asc')
    .limit(Math.min(input.limit ?? 50, 100)).get();
  let succeeded = 0; let retryable = 0; let deadLetter = 0;
  for (const document of due.docs) {
    const leased = await db.runTransaction(async (tx) => {
      const current = await tx.get(document.ref);
      if (!current.exists || !['pending', 'retryable'].includes(String(current.get('state')))) return false;
      const lease = current.get('leaseUntil');
      if (lease instanceof Timestamp && lease.toDate().getTime() > nowDate.getTime()) return false;
      tx.update(document.ref, { state: 'processing', workerId: input.workerId, leaseUntil: Timestamp.fromDate(new Date(nowDate.getTime() + 60_000)), updatedAt: Timestamp.fromDate(nowDate) });
      return true;
    });
    if (!leased) continue;
    try {
      const current = await document.ref.get();
      const booking = await db.collection('service_bookings').doc(String(current.get('bookingId'))).get();
      if (!booking.exists || booking.get('state') !== 'confirmed' || booking.get('payment.state') !== 'approved') {
        await document.ref.update({ state: 'cancelled', lastErrorCode: 'BOOKING_NO_LONGER_ELIGIBLE', updatedAt: Timestamp.fromDate(nowDate) });
        continue;
      }
      const result = await input.adapters.execute(current.data()!);
      await document.ref.update({ state: 'succeeded', providerReference: result.providerReference, attempts: Number(current.get('attempts')) + 1, leaseUntil: null, updatedAt: Timestamp.fromDate(nowDate) });
      succeeded += 1;
    } catch (error) {
      const current = await document.ref.get();
      const attempts = Number(current.get('attempts') ?? 0) + 1;
      const terminal = attempts >= 5;
      await document.ref.update({
        state: terminal ? 'dead_letter' : 'retryable', attempts,
        nextAttemptAt: Timestamp.fromDate(new Date(nowDate.getTime() + Math.min(2 ** attempts * 60_000, 3_600_000))),
        leaseUntil: null, lastErrorCode: error instanceof HttpError ? error.code : 'EXTERNAL_EFFECT_FAILED', updatedAt: Timestamp.fromDate(nowDate),
      });
      if (terminal) deadLetter += 1; else retryable += 1;
    }
  }
  return { succeeded, retryable, deadLetter };
}
