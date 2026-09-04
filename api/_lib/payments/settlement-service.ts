import { createHash } from 'node:crypto';
import { FieldValue, Timestamp, type Firestore, type Transaction } from 'firebase-admin/firestore';

import { canReceiveServices, type ProfessionalLifecycle } from '../../../shared/professional-domain.js';
import { normalizeMercadoPagoStatus, type VerifiedPaymentState } from '../../../shared/payment-domain.js';
import { getAdminFirestore } from '../firebase-admin.js';
import { HttpError } from '../http-errors.js';
import { capacityLockId } from '../bookings/hold-service.js';
import { enqueueBookingOutbox } from './outbox-service.js';
import { expectedMercadoPagoLiveMode, type ProviderPaymentSnapshot } from './mercado-pago-provider.js';

function eventIdFor(payment: ProviderPaymentSnapshot): string {
  return createHash('sha256').update([
    payment.id, payment.updatedAt, payment.status, payment.statusDetail ?? '',
    payment.externalReference, String(payment.transactionAmount), payment.currency, String(payment.liveMode),
  ].join(':')).digest('hex');
}

function payloadHash(payment: ProviderPaymentSnapshot): string {
  return createHash('sha256').update(JSON.stringify({
    id: payment.id, status: payment.status, statusDetail: payment.statusDetail,
    externalReference: payment.externalReference, transactionAmount: payment.transactionAmount,
    currency: payment.currency, liveMode: payment.liveMode, updatedAt: payment.updatedAt,
  })).digest('hex');
}

function parseOrderId(externalReference: string): string | null {
  const match = /^mpo_v1_([a-f0-9]{64})$/.exec(externalReference);
  return match?.[1] ?? null;
}

export interface IngestedPaymentEvent {
  eventId: string;
  orderId?: string;
  state: VerifiedPaymentState;
  validForOrder: boolean;
  reasonCodes: string[];
}

function writeReconciliationIssue(tx: Transaction, db: Firestore, input: {
  id: string; orderId?: string; paymentId: string; reasonCodes: string[]; now: Timestamp;
}): void {
  tx.set(db.collection('payment_reconciliation_issues').doc(input.id), {
    schemaVersion: 1, state: 'open', requiresHumanReview: true,
    ...(input.orderId ? { orderId: input.orderId } : {}), providerPaymentId: input.paymentId,
    reasonCodes: input.reasonCodes, createdAt: input.now, updatedAt: input.now,
  }, { merge: true });
}

export async function ingestVerifiedProviderPayment(input: {
  payment: ProviderPaymentSnapshot;
  receiptId: string;
  expectedLiveMode?: boolean;
  now?: Date;
}, db: Firestore = getAdminFirestore()): Promise<IngestedPaymentEvent> {
  const eventId = eventIdFor(input.payment);
  const orderId = parseOrderId(input.payment.externalReference) ?? undefined;
  const state = normalizeMercadoPagoStatus(input.payment.status);
  const now = Timestamp.fromDate(input.now ?? new Date());
  const reasonCodes: string[] = [];
  const order = orderId ? await db.collection('orders').doc(orderId).get() : null;
  if (!orderId) reasonCodes.push('EXTERNAL_REFERENCE_INVALID');
  if (!order?.exists) reasonCodes.push('ORDER_NOT_FOUND');
  if (order?.exists && order.get('amount.total') !== input.payment.transactionAmount) reasonCodes.push('AMOUNT_MISMATCH');
  if (order?.exists && order.get('amount.currency') !== input.payment.currency) reasonCodes.push('CURRENCY_MISMATCH');
  if (input.payment.liveMode !== (input.expectedLiveMode ?? expectedMercadoPagoLiveMode())) reasonCodes.push('ENVIRONMENT_MISMATCH');
  const validForOrder = reasonCodes.length === 0;
  await db.runTransaction(async (tx) => {
    const eventRef = db.collection('payment_events').doc(eventId);
    const existing = await tx.get(eventRef);
    if (existing.exists) return;
    tx.create(eventRef, {
      schemaVersion: 1, provider: 'mercado_pago', providerPaymentId: input.payment.id,
      providerUpdatedAt: input.payment.updatedAt, providerStatus: input.payment.status,
      ...(input.payment.statusDetail ? { providerStatusDetail: input.payment.statusDetail } : {}),
      normalizedState: state, externalReference: input.payment.externalReference,
      amount: input.payment.transactionAmount, currency: input.payment.currency, liveMode: input.payment.liveMode,
      payloadHash: payloadHash(input.payment), receiptId: input.receiptId,
      processingState: validForOrder ? 'pending' : 'needs_resolution', reasonCodes,
      createdAt: now,
    });
    if (!validForOrder) writeReconciliationIssue(tx, db, { id: eventId, orderId, paymentId: input.payment.id, reasonCodes, now });
    if (!validForOrder && state === 'approved' && orderId && order?.exists) {
      const attemptId = order.get('payment.attemptId');
      tx.update(order.ref, {
        state: 'paid_needs_resolution',
        payment: { state: 'approved', ...(attemptId ? { attemptId } : {}), providerPaymentId: input.payment.id, approvedAt: now },
        version: Number(order.get('version')) + 1,
        updatedAt: now,
      });
      if (attemptId) {
        tx.set(db.collection('payment_attempts').doc(String(attemptId)), {
          state: 'approved', providerPaymentId: input.payment.id, providerUpdatedAt: input.payment.updatedAt,
          updatedAt: now,
        }, { merge: true });
      }
    }
  });
  return { eventId, orderId, state, validForOrder, reasonCodes };
}

function bookingProjectionData(booking: FirebaseFirestore.DocumentSnapshot, paymentId: string) {
  const schedule = booking.get('schedule') ?? {};
  const service = booking.get('service') ?? {};
  const commercial = booking.get('commercialSnapshot') ?? {};
  const assignment = booking.get('assignment') ?? {};
  return {
    id: booking.id, date: String(schedule.localDate ?? ''), shift: String(schedule.slot ?? ''),
    service: String(service.catalogItemId ?? 'Curadoria residencial'), status: 'confirmed',
    amount: Number(commercial.quotedAmount ?? 0), paymentState: 'approved',
    providerReference: paymentId, assignedProfessionalUid: String(assignment.professionalUid ?? ''),
  };
}

function writeConfirmedProjections(tx: Transaction, db: Firestore, booking: FirebaseFirestore.DocumentSnapshot, paymentId: string): void {
  const data = bookingProjectionData(booking, paymentId);
  const customer = booking.get('customer') ?? {};
  if (customer.kind === 'authenticated' && customer.clientUid) {
    tx.set(db.collection('client_booking_views').doc(String(customer.clientUid)).collection('items').doc(booking.id), {
      bookingId: booking.id, clientUid: String(customer.clientUid), date: data.date, shift: data.shift,
      service: data.service, status: 'confirmed', totalPrice: data.amount,
    });
  }
  tx.set(db.collection('operations_booking_views').doc(booking.id), {
    bookingId: booking.id, customerKind: customer.kind,
    ...(customer.clientUid ? { clientUid: customer.clientUid } : {}),
    ...(customer.guestIntentId ? { guestIntentId: customer.guestIntentId } : {}),
    professionalUid: data.assignedProfessionalUid, date: data.date, shift: data.shift,
    service: data.service, status: 'confirmed', clientDisplayName: 'Cliente',
  });
  tx.set(db.collection('professional_booking_views').doc(data.assignedProfessionalUid).collection('items').doc(booking.id), {
    bookingId: booking.id, professionalUid: data.assignedProfessionalUid, date: data.date,
    shift: data.shift, service: data.service, status: 'confirmed', clientDisplayName: 'Cliente',
    addressAccessState: 'available_via_command',
  });
  tx.set(db.collection('finance_booking_views').doc(booking.id), {
    bookingId: booking.id, customerKind: customer.kind,
    ...(customer.clientUid ? { clientUid: customer.clientUid } : {}),
    ...(customer.guestIntentId ? { guestIntentId: customer.guestIntentId } : {}),
    quotedAmount: data.amount, currency: 'BRL', paymentState: 'approved', providerReference: paymentId,
  });
}

export async function applyPaymentEvent(input: {
  eventId: string;
  now?: Date;
}, db: Firestore = getAdminFirestore()): Promise<{ outcome: 'applied' | 'duplicate' | 'ignored' | 'needs_resolution'; orderId?: string }> {
  const nowDate = input.now ?? new Date();
  const now = Timestamp.fromDate(nowDate);
  return db.runTransaction(async (tx) => {
    const eventRef = db.collection('payment_events').doc(input.eventId);
    const applicationRef = db.collection('payment_event_applications').doc(input.eventId);
    const [event, application] = await tx.getAll(eventRef, applicationRef);
    if (!event.exists) throw new HttpError(404, 'PAYMENT_EVENT_NOT_FOUND', 'Payment event not found');
    if (application.exists) return application.get('result') as { outcome: 'duplicate'; orderId?: string };
    if (event.get('processingState') === 'needs_resolution') {
      const result = { outcome: 'needs_resolution' as const };
      tx.create(applicationRef, { schemaVersion: 1, result, createdAt: now });
      return result;
    }
    const orderId = parseOrderId(String(event.get('externalReference')));
    if (!orderId) throw new HttpError(409, 'PAYMENT_EVENT_INVALID', 'Payment event is invalid');
    const orderRef = db.collection('orders').doc(orderId);
    const order = await tx.get(orderRef);
    if (!order.exists) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
    const attemptId = String(order.get('payment.attemptId'));
    const attemptRef = db.collection('payment_attempts').doc(attemptId);
    const bookingIds = order.get('bookingIds') as string[];
    const bookingRefs = bookingIds.map((id) => db.collection('service_bookings').doc(id));
    const [attempt, ...bookings] = await tx.getAll(attemptRef, ...bookingRefs);
    if (!attempt.exists || bookings.some((booking) => !booking.exists)) throw new HttpError(409, 'PAYMENT_LINKAGE_INVALID', 'Payment linkage requires reconciliation');

    const providerUpdatedAt = String(event.get('providerUpdatedAt'));
    const lastProviderUpdatedAt = attempt.get('providerUpdatedAt');
    if (typeof lastProviderUpdatedAt === 'string' && providerUpdatedAt < lastProviderUpdatedAt) {
      tx.update(eventRef, { processingState: 'ignored_stale', processedAt: now });
      const result = { outcome: 'ignored' as const, orderId };
      tx.create(applicationRef, { schemaVersion: 1, result, createdAt: now });
      return result;
    }

    const normalized = event.get('normalizedState') as VerifiedPaymentState;
    const paymentId = String(event.get('providerPaymentId'));
    if (normalized === 'approved' && order.get('state') === 'paid'
        && order.get('payment.providerPaymentId') === paymentId) {
      tx.update(eventRef, { processingState: 'applied', processedAt: now });
      const result = { outcome: 'duplicate' as const, orderId };
      tx.create(applicationRef, { schemaVersion: 1, result, createdAt: now });
      return result;
    }
    if (normalized !== 'approved') {
      const attemptState = normalized === 'pending' ? 'pending' : normalized === 'unknown' ? 'unknown' : normalized;
      tx.update(attemptRef, { state: attemptState, providerPaymentId: paymentId, providerUpdatedAt, version: Number(attempt.get('version')) + 1, updatedAt: now });
      if (normalized === 'rejected') tx.update(orderRef, { state: 'payment_failed', payment: { state: 'rejected', attemptId, providerPaymentId: paymentId }, version: Number(order.get('version')) + 1, updatedAt: now });
      if (normalized === 'cancelled') tx.update(orderRef, { state: 'cancelled', payment: { state: 'cancelled', attemptId, providerPaymentId: paymentId }, version: Number(order.get('version')) + 1, updatedAt: now });
      if (normalized === 'refunded' || normalized === 'charged_back') {
        tx.update(orderRef, { state: normalized, payment: { state: normalized, attemptId, providerPaymentId: paymentId }, version: Number(order.get('version')) + 1, updatedAt: now });
      }
      tx.update(eventRef, { processingState: 'applied', processedAt: now });
      const result = { outcome: 'applied' as const, orderId };
      tx.create(applicationRef, { schemaVersion: 1, result, createdAt: now });
      return result;
    }

    if (order.get('payment.providerPaymentId') && order.get('payment.providerPaymentId') !== paymentId) {
      const reasonCodes = ['DUPLICATE_APPROVED_PAYMENT'];
      tx.update(orderRef, { state: 'paid_needs_resolution', version: Number(order.get('version')) + 1, updatedAt: now });
      tx.update(eventRef, { processingState: 'needs_resolution', reasonCodes, processedAt: now });
      writeReconciliationIssue(tx, db, { id: input.eventId, orderId, paymentId, reasonCodes, now });
      const result = { outcome: 'needs_resolution' as const, orderId };
      tx.create(applicationRef, { schemaVersion: 1, result, createdAt: now });
      return result;
    }

    const holdRefs = bookings.map((booking) => db.collection('booking_holds').doc(String(booking.get('holdId'))));
    const professionalRefs = bookings.map((booking) => db.collection('professionals').doc(String(booking.get('assignment.professionalUid'))));
    const [holds, professionals] = await Promise.all([tx.getAll(...holdRefs), tx.getAll(...professionalRefs)]);
    const lockRefs = bookings.flatMap((booking, index) => {
      const hold = holds[index];
      return (hold.exists ? hold.get('segments') as ('morning' | 'afternoon')[] : []).map((segment) =>
        db.collection('capacity_slot_locks').doc(capacityLockId(String(booking.get('assignment.professionalUid')), String(booking.get('schedule.localDate')), segment)));
    });
    const locks = lockRefs.length ? await tx.getAll(...lockRefs) : [];
    const reasonCodes: string[] = [];
    if (order.get('state') !== 'payment_pending') reasonCodes.push(`ORDER_STATE_INVALID:${String(order.get('state'))}`);
    bookings.forEach((booking, index) => {
      const hold = holds[index]; const professional = professionals[index];
      if (booking.get('state') !== 'pending_confirmation') reasonCodes.push(`BOOKING_STATE_INVALID:${booking.id}`);
      if (!hold.exists || hold.get('state') !== 'active' || !(hold.get('expiresAt') instanceof Timestamp)
          || hold.get('expiresAt').toDate().getTime() <= nowDate.getTime()) reasonCodes.push(`HOLD_INACTIVE:${booking.id}`);
      if (!professional.exists || !canReceiveServices(professional.get('lifecycle') as ProfessionalLifecycle)) reasonCodes.push(`PROFESSIONAL_INELIGIBLE:${booking.id}`);
    });
    let validationLockOffset = 0;
    bookings.forEach((booking, index) => {
      const hold = holds[index];
      const segmentCount = hold.exists ? (hold.get('segments') as unknown[]).length : 0;
      const bookingLocks = locks.slice(validationLockOffset, validationLockOffset + segmentCount);
      validationLockOffset += segmentCount;
      bookingLocks.forEach((lock) => {
        if (!lock.exists || lock.get('kind') !== 'hold' || lock.get('ownerId') !== hold.id) {
          reasonCodes.push(`LOCK_INVALID:${lock.id}`);
        }
      });
    });
    if (reasonCodes.length > 0) {
      tx.update(orderRef, { state: 'paid_needs_resolution', payment: { state: 'approved', attemptId, providerPaymentId: paymentId, approvedAt: now }, version: Number(order.get('version')) + 1, updatedAt: now });
      tx.update(attemptRef, { state: 'approved', providerPaymentId: paymentId, providerUpdatedAt, version: Number(attempt.get('version')) + 1, updatedAt: now });
      bookings.forEach((booking) => tx.update(booking.ref, { payment: { state: 'approved', orderId }, version: Number(booking.get('version')) + 1, updatedAt: now }));
      tx.update(eventRef, { processingState: 'needs_resolution', reasonCodes, processedAt: now });
      writeReconciliationIssue(tx, db, { id: input.eventId, orderId, paymentId, reasonCodes, now });
      const result = { outcome: 'needs_resolution' as const, orderId };
      tx.create(applicationRef, { schemaVersion: 1, result, createdAt: now });
      return result;
    }

    let lockOffset = 0;
    bookings.forEach((booking, index) => {
      const hold = holds[index];
      const segmentCount = (hold.get('segments') as unknown[]).length;
      const bookingLocks = lockRefs.slice(lockOffset, lockOffset + segmentCount); lockOffset += segmentCount;
      bookingLocks.forEach((lockRef) => tx.update(lockRef, { kind: 'booking', ownerId: booking.id, expiresAt: FieldValue.delete(), updatedAt: now }));
      tx.update(hold.ref, { state: 'consumed', version: Number(hold.get('version')) + 1, updatedAt: now });
      tx.update(booking.ref, {
        state: 'confirmed', payment: { state: 'approved', orderId },
        assignment: { state: 'assigned', professionalUid: booking.get('assignment.professionalUid'), revision: Number(booking.get('assignment.revision')) + 1 },
        version: Number(booking.get('version')) + 1, updatedAt: now,
      });
      writeConfirmedProjections(tx, db, booking, paymentId);
      enqueueBookingOutbox(tx, db, { bookingId: booking.id, orderId, now });
      tx.create(db.collection('booking_events').doc(), { schemaVersion: 1, bookingId: booking.id, actorUid: 'mercado_pago', action: 'booking.confirmed_by_payment', requestId: input.eventId, idempotencyKey: input.eventId, metadata: { orderId, paymentEventId: input.eventId }, createdAt: now });
    });
    tx.update(orderRef, { state: 'paid', payment: { state: 'approved', attemptId, providerPaymentId: paymentId, approvedAt: now }, version: Number(order.get('version')) + 1, updatedAt: now });
    tx.update(attemptRef, { state: 'approved', providerPaymentId: paymentId, providerUpdatedAt, version: Number(attempt.get('version')) + 1, updatedAt: now });
    tx.update(eventRef, { processingState: 'applied', processedAt: now });
    if (order.get('customer.kind') === 'guest') tx.update(db.collection('guest_purchase_intents').doc(String(order.get('customer.guestIntentId'))), { state: 'paid', updatedAt: now });
    tx.create(db.collection('audit_log').doc(), { actorUid: 'mercado_pago', action: 'payment.applied', target: `orders/${orderId}`, metadata: { paymentEventId: input.eventId, bookingIds }, createdAt: now });
    const result = { outcome: 'applied' as const, orderId };
    tx.create(applicationRef, { schemaVersion: 1, result, createdAt: now });
    return result;
  });
}
