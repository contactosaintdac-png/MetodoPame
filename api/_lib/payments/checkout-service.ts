import { createHash } from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import type { AuthenticatedIdentity } from '../authenticate.js';
import { canReceiveServices, type ProfessionalLifecycle } from '../../../shared/professional-domain.js';
import { slotSegments, type BookingSlot } from '../../../shared/booking-domain.js';
import { commandPayloadHash } from '../bookings/idempotency.js';
import { assertEmulatorOnlyApply, capacityLockId, resolveHoldTtlSeconds } from '../bookings/hold-service.js';
import { getAdminFirestore } from '../firebase-admin.js';
import { HttpError } from '../http-errors.js';
import { deriveGuestToken, guestIntentId, guestIntentTtlSeconds, guestTokenHash, requireGuestTokenSecret } from './guest-access.js';
import { resolveServerPrice, type PricingInput, type ServerPriceQuote } from './pricing.js';

export interface CheckoutIntentInput extends PricingInput {
  localDate: string;
  slot: BookingSlot;
  clientName: string;
  clientEmail?: string;
  clientPhone: string;
  address: string;
  idempotencyKey: string;
  requestId: string;
  identity?: AuthenticatedIdentity;
  now?: Date;
}

export interface PreparedCheckout {
  orderId: string;
  attemptId: string;
  bookingIds: string[];
  amount: number;
  currency: 'BRL';
  pricingVersion: string;
  externalReference: string;
  providerIdempotencyKey: string;
  payerName: string;
  payerEmail?: string;
  guestAccessToken?: string;
  preference?: { id: string; initPoint: string };
}

function deterministicId(namespace: string, value: string): string {
  return createHash('sha256').update(`${namespace}:${value}`).digest('hex');
}

function checkoutDates(localDate: string, mode: 'avulso' | 'mensal'): string[] {
  if (mode === 'avulso') return [localDate];
  const date = new Date(`${localDate}T12:00:00.000Z`);
  return Array.from({ length: 4 }, (_, index) => {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + index * 7);
    return result.toISOString().slice(0, 10);
  });
}

function lockUnavailable(data: FirebaseFirestore.DocumentData, now: Date): boolean {
  if (data.kind === 'booking') return true;
  if (data.kind !== 'hold') return false;
  const expiry = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : null;
  return Boolean(expiry && expiry.getTime() > now.getTime());
}

export async function prepareCheckout(
  input: CheckoutIntentInput,
  db: Firestore = getAdminFirestore(),
  options: {
    emulatorGuard?: boolean;
    guestSecret?: string;
    guestTtlSeconds?: number;
    holdTtlSeconds?: number;
  } = {},
): Promise<PreparedCheckout> {
  if (options.emulatorGuard !== false) assertEmulatorOnlyApply();
  const nowDate = input.now ?? new Date();
  const now = Timestamp.fromDate(nowDate);
  const quote = resolveServerPrice(input);
  const payloadHash = commandPayloadHash({
    format: input.format, mode: input.mode, triage: input.triage, addons: input.addons,
    localDate: input.localDate, slot: input.slot, clientName: input.clientName,
    clientEmail: input.clientEmail, clientPhone: input.clientPhone, address: input.address,
    identityUid: input.identity?.uid,
  });
  // Guest idempotency keys are high-entropy client-generated capabilities. Keep
  // the receipt stable across payload changes so reusing one cannot create a
  // second order with different commercial data.
  const actorKey = input.identity?.uid ?? 'guest';
  const rootKey = `${actorKey}:${input.idempotencyKey}:${payloadHash}`;
  const intentId = input.identity ? undefined : guestIntentId(input.idempotencyKey, payloadHash);
  const guestSecret = input.identity ? undefined : (options.guestSecret ?? requireGuestTokenSecret());
  const guestToken = guestSecret ? deriveGuestToken(guestSecret, input.idempotencyKey, payloadHash) : undefined;
  const orderId = deterministicId('order', rootKey);
  const attemptId = deterministicId('payment-attempt', rootKey);
  const receiptId = deterministicId('checkout-command', `${actorKey}:${input.idempotencyKey}`);
  const residenceId = deterministicId('checkout-residence', rootKey);
  const dates = checkoutDates(input.localDate, input.mode);
  const bookingIds = dates.map((date) => deterministicId('service-booking', `${rootKey}:${date}`));
  const requestIds = dates.map((date) => deterministicId('booking-request', `${rootKey}:${date}`));
  const holdIds = dates.map((date) => deterministicId('booking-hold', `${rootKey}:${date}`));
  const holdTtl = options.holdTtlSeconds ?? resolveHoldTtlSeconds();
  const holdExpiresAt = new Date(nowDate.getTime() + holdTtl * 1_000);
  const intentTtl = input.identity ? undefined : (options.guestTtlSeconds ?? guestIntentTtlSeconds());

  const capacity = await db.collection('professional_capacity')
    .where('eligibleForService', '==', true)
    .orderBy('assignmentPriority.order', 'asc')
    .limit(20)
    .get();
  if (capacity.empty) throw new HttpError(409, 'NO_ELIGIBLE_PROFESSIONAL', 'No eligible professional is available');
  const candidateUids = capacity.docs.map((document) => document.id);

  const result = await db.runTransaction(async (tx) => {
    const receiptRef = db.collection('checkout_command_receipts').doc(receiptId);
    const receipt = await tx.get(receiptRef);
    if (receipt.exists) {
      if (receipt.get('payloadHash') !== payloadHash) {
        throw new HttpError(409, 'IDEMPOTENCY_KEY_REUSED', 'Idempotency key was already used with a different payload');
      }
      return receipt.get('result') as PreparedCheckout;
    }

    const professionalRefs = candidateUids.map((uid) => db.collection('professionals').doc(uid));
    const segments = slotSegments(input.slot);
    const lockRefs = candidateUids.flatMap((uid) => dates.flatMap((date) =>
      segments.map((segment) => db.collection('capacity_slot_locks').doc(capacityLockId(uid, date, segment)))));
    const [professionals, locks] = await Promise.all([
      tx.getAll(...professionalRefs),
      tx.getAll(...lockRefs),
    ]);
    const lockById = new Map(locks.map((lock) => [lock.id, lock]));
    const eligible = professionals
      .filter((professional) => professional.exists
        && canReceiveServices(professional.get('lifecycle') as ProfessionalLifecycle))
      .map((professional) => professional.id);
    const assignments = dates.map((date) => eligible.find((uid) => segments.every((segment) => {
      const lock = lockById.get(capacityLockId(uid, date, segment));
      return !lock?.exists || !lockUnavailable(lock.data()!, nowDate);
    })));
    if (assignments.some((uid) => !uid)) {
      throw new HttpError(409, 'SLOT_UNAVAILABLE', 'Capacity slot is unavailable');
    }

    const customer = input.identity
      ? { kind: 'authenticated' as const, clientUid: input.identity.uid }
      : { kind: 'guest' as const, guestIntentId: intentId! };
    tx.create(db.collection('residences').doc(residenceId), {
      schemaVersion: 1, version: 1, customer, state: 'checkout_pending', createdAt: now, updatedAt: now,
    });
    tx.create(db.collection('residence_private').doc(residenceId), {
      schemaVersion: 1, customer, address: input.address, phone: input.clientPhone, createdAt: now, updatedAt: now,
    });

    dates.forEach((date, index) => {
      const professionalUid = assignments[index]!;
      tx.create(db.collection('booking_requests').doc(requestIds[index]), {
        schemaVersion: 1, version: 2, customer, ...(input.identity ? { clientUid: input.identity.uid } : { guestIntentId: intentId }),
        residenceId, state: 'converted', holdId: holdIds[index], bookingId: bookingIds[index],
        requestedSchedule: { timezone: 'America/Sao_Paulo', localDate: date, slot: input.slot },
        requestedService: { catalogItemId: `curadoria_${input.format}`, format: input.format === 'meio' ? 'half_day' : 'full_day', addonCodes: input.addons },
        source: { kind: 'native', references: [] }, createdAt: now, updatedAt: now,
      });
      tx.create(db.collection('booking_holds').doc(holdIds[index]), {
        schemaVersion: 1, version: 1, requestId: requestIds[index], customer,
        ...(input.identity ? { clientUid: input.identity.uid } : { guestIntentId: intentId }),
        professionalUid, localDate: date, slot: input.slot, segments: [...segments], state: 'active',
        expiresAt: Timestamp.fromDate(holdExpiresAt), createdAt: now, updatedAt: now,
      });
      segments.forEach((segment) => tx.set(
        db.collection('capacity_slot_locks').doc(capacityLockId(professionalUid, date, segment)),
        { schemaVersion: 1, professionalUid, localDate: date, segment, kind: 'hold', ownerId: holdIds[index], expiresAt: Timestamp.fromDate(holdExpiresAt), createdAt: now, updatedAt: now },
      ));
      const perBookingAmount = input.mode === 'mensal' ? quote.total / 4 : quote.total;
      tx.create(db.collection('service_bookings').doc(bookingIds[index]), {
        schemaVersion: 1, version: 1, customer,
        ...(input.identity ? { clientUid: input.identity.uid } : { guestIntentId: intentId }),
        residenceId, requestId: requestIds[index], state: 'pending_confirmation',
        schedule: { timezone: 'America/Sao_Paulo', localDate: date, slot: input.slot, revision: 1 },
        service: { catalogItemId: `curadoria_${input.format}`, format: input.format === 'meio' ? 'half_day' : 'full_day', addonCodes: input.addons },
        commercialSnapshot: { quotedAmount: perBookingAmount, currency: 'BRL', pricingVersion: quote.pricingVersion, authority: 'server' },
        payment: { state: 'pending', orderId }, assignment: { state: 'provisional', professionalUid, revision: 1 },
        holdId: holdIds[index], source: { kind: 'native', references: [] }, createdAt: now, updatedAt: now,
      });
    });

    tx.create(db.collection('orders').doc(orderId), {
      schemaVersion: 1, version: 1, customer, bookingIds, state: 'created',
      amount: { total: quote.total, currency: quote.currency }, pricingVersion: quote.pricingVersion,
      payment: { state: 'unverified', attemptId }, createdAt: now, updatedAt: now,
    });
    tx.create(db.collection('payment_attempts').doc(attemptId), {
      schemaVersion: 1, version: 1, orderId, provider: 'mercado_pago', state: 'creating',
      externalReference: `mpo_v1_${orderId}`, providerIdempotencyKey: attemptId, createdAt: now, updatedAt: now,
    });
    tx.create(db.collection('order_private').doc(orderId), {
      schemaVersion: 1, customer, name: input.clientName, ...(input.clientEmail ? { email: input.clientEmail } : {}),
      phone: input.clientPhone, createdAt: now, updatedAt: now,
    });
    if (intentId && guestToken && intentTtl) {
      tx.create(db.collection('guest_purchase_intents').doc(intentId), {
        schemaVersion: 1, version: 1, tokenHash: guestTokenHash(guestToken), bookingIds, orderId,
        state: 'active', expiresAt: Timestamp.fromDate(new Date(nowDate.getTime() + intentTtl * 1_000)),
        createdAt: now, updatedAt: now,
      });
    }
    const commandResult: PreparedCheckout = {
      orderId, attemptId, bookingIds, amount: quote.total, currency: quote.currency,
      pricingVersion: quote.pricingVersion, externalReference: `mpo_v1_${orderId}`,
      providerIdempotencyKey: attemptId, payerName: input.clientName,
      ...(input.clientEmail ? { payerEmail: input.clientEmail } : {}),
    };
    tx.create(receiptRef, {
      schemaVersion: 1, actorKey, idempotencyKey: input.idempotencyKey, payloadHash,
      result: commandResult, createdAt: now,
    });
    tx.create(db.collection('audit_log').doc(), {
      actorUid: input.identity?.uid ?? 'guest_checkout', action: 'checkout.prepared', target: `orders/${orderId}`,
      metadata: { requestId: input.requestId, bookingCount: bookingIds.length, customerKind: customer.kind }, createdAt: now,
    });
    return commandResult;
  });

  return {
    ...result,
    ...(guestToken ? { guestAccessToken: guestToken } : {}),
  };
}

export async function attachPreference(input: {
  orderId: string;
  attemptId: string;
  preference: { id: string; initPoint: string };
  now?: Date;
}, db: Firestore = getAdminFirestore()): Promise<void> {
  const now = Timestamp.fromDate(input.now ?? new Date());
  await db.runTransaction(async (tx) => {
    const orderRef = db.collection('orders').doc(input.orderId);
    const attemptRef = db.collection('payment_attempts').doc(input.attemptId);
    const [order, attempt] = await tx.getAll(orderRef, attemptRef);
    if (!order.exists || !attempt.exists || attempt.get('orderId') !== input.orderId) {
      throw new HttpError(404, 'CHECKOUT_NOT_FOUND', 'Checkout not found');
    }
    if (attempt.get('preferenceId')) return;
    tx.update(attemptRef, {
      state: 'pending', preferenceId: input.preference.id, initPoint: input.preference.initPoint,
      version: Number(attempt.get('version')) + 1, updatedAt: now,
    });
    tx.update(orderRef, { state: 'payment_pending', version: Number(order.get('version')) + 1, updatedAt: now });
    if (order.get('customer.kind') === 'guest') {
      tx.update(db.collection('guest_purchase_intents').doc(String(order.get('customer.guestIntentId'))), {
        state: 'checkout_created', version: 2, updatedAt: now,
      });
    }
  });
}
