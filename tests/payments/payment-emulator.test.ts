import assert from 'node:assert/strict';
import test from 'node:test';

import { generateKeyPairSync } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';

import { getAdminFirestore } from '../../api/_lib/firebase-admin.js';
import { authorizeGuestBooking } from '../../api/_lib/payments/guest-access.js';
import { attachPreference, prepareCheckout } from '../../api/_lib/payments/checkout-service.js';
import { createExternalEffectAdapter } from '../../api/_lib/payments/external-effect-adapter.js';
import { processOutboxJobs } from '../../api/_lib/payments/outbox-service.js';
import { reconcilePayments } from '../../api/_lib/payments/reconciliation-service.js';
import { applyPaymentEvent, ingestVerifiedProviderPayment } from '../../api/_lib/payments/settlement-service.js';
import { processMercadoPagoWebhook } from '../../api/_lib/payments/webhook-service.js';
import { processR7PreviewTestWebhook, R7_TEST_WEBHOOK_FIXTURE_ID } from '../../api/_lib/payments/r7-preview-test-webhook.js';

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const db = hasEmulator ? getAdminFirestore() : null;
const lifecycle = {
  approval: { state: 'approved' }, operations: { state: 'active' },
  training: { state: 'not_started' }, certification: { state: 'not_certified' },
};
const baseInput = {
  format: 'completo' as const, mode: 'avulso' as const,
  triage: { rooms: 3, baths: 2, floors: 1, marble: false, wood: false, doubleGlass: false, chandeliers: false },
  addons: [] as [], localDate: '2026-09-20', slot: 'full_day' as const,
  clientName: 'Cliente Teste', clientEmail: 'client@example.test', clientPhone: '5548999999999',
  address: 'Rua Privada 123', idempotencyKey: 'checkout-emulator-001', requestId: 'request-emulator-001',
  now: new Date('2026-09-01T12:00:00.000Z'),
};

async function clearCollections() {
  if (!db) return;
  for (const name of [
    'professional_capacity', 'professionals', 'capacity_slot_locks', 'booking_requests', 'booking_holds',
    'service_bookings', 'orders', 'payment_attempts', 'payment_events', 'payment_event_applications',
    'guest_purchase_intents', 'checkout_command_receipts', 'outbox_jobs', 'payment_reconciliation_issues',
    'operations_booking_views', 'finance_booking_views', 'audit_log', 'booking_events', 'residences',
    'residence_private', 'order_private', 'r7_test_webhook_receipts',
  ]) {
    const snapshot = await db.collection(name).get();
    for (const document of snapshot.docs) await document.ref.delete();
  }
}

async function seedProfessional(uid = 'pro-one') {
  await db!.collection('professionals').doc(uid).set({ lifecycle });
  await db!.collection('professional_capacity').doc(uid).set({
    eligibleForService: true, assignmentPriority: { tier: 'approved', order: 1 },
  });
}

async function guestCheckout(idempotencyKey = baseInput.idempotencyKey) {
  const checkout = await prepareCheckout({ ...baseInput, idempotencyKey }, db!, {
    guestSecret: 'g'.repeat(32), guestTtlSeconds: 900, holdTtlSeconds: 900,
  });
  await attachPreference({
    orderId: checkout.orderId,
    attemptId: checkout.attemptId,
    preference: { id: `preference-${checkout.attemptId}`, initPoint: 'https://sandbox.example.test/checkout' },
    now: baseInput.now,
  }, db!);
  return checkout;
}

function approvedPayment(checkout: Awaited<ReturnType<typeof guestCheckout>>, overrides: Record<string, unknown> = {}) {
  return {
    id: '900001', status: 'approved', statusDetail: 'accredited',
    externalReference: checkout.externalReference, transactionAmount: checkout.amount,
    currency: checkout.currency, liveMode: false, updatedAt: '2026-09-01T12:01:00.000Z',
    ...overrides,
  };
}

test.beforeEach(async () => {
  if (!hasEmulator) return;
  await clearCollections();
  await seedProfessional();
});

test('guest checkout creates opaque scoped access while authenticated checkout uses Auth UID', { skip: !hasEmulator }, async () => {
  const guest = await guestCheckout();
  assert.ok(guest.guestAccessToken);
  const guestBooking = await db!.collection('service_bookings').doc(guest.bookingIds[0]).get();
  assert.equal(guestBooking.get('customer.kind'), 'guest');
  assert.equal(guestBooking.get('clientUid'), undefined);
  await authorizeGuestBooking({ db: db!, bookingId: guest.bookingIds[0], token: guest.guestAccessToken!, now: baseInput.now });
  await assert.rejects(() => authorizeGuestBooking({ db: db!, bookingId: guest.bookingIds[0], token: 'forged', now: baseInput.now }), (error: unknown) => (error as { code?: string }).code === 'GUEST_CHECKOUT_ACCESS_DENIED');

  const authenticated = await prepareCheckout({
    ...baseInput, idempotencyKey: 'checkout-authenticated-001', requestId: 'request-authenticated-001',
    localDate: '2026-09-21',
    identity: { uid: 'client-auth', email: 'auth@example.test', emailVerified: true },
  }, db!, { holdTtlSeconds: 900 });
  const authBooking = await db!.collection('service_bookings').doc(authenticated.bookingIds[0]).get();
  assert.equal(authBooking.get('customer.clientUid'), 'client-auth');
  assert.equal(authBooking.get('guestIntentId'), undefined);
  assert.equal(authenticated.guestAccessToken, undefined);
});

test('guest idempotency key cannot be reused with a different payload', { skip: !hasEmulator }, async () => {
  await guestCheckout('checkout-guest-idempotency-001');
  await assert.rejects(() => prepareCheckout({
    ...baseInput,
    triage: { ...baseInput.triage, rooms: 4 },
    idempotencyKey: 'checkout-guest-idempotency-001',
  }, db!, {
    guestSecret: 'g'.repeat(32), guestTtlSeconds: 900, holdTtlSeconds: 900,
  }), (error: unknown) => (error as { code?: string }).code === 'IDEMPOTENCY_KEY_REUSED');
});

test('approved payment confirms booking, consumes hold, converts locks and enqueues effects once', { skip: !hasEmulator }, async () => {
  const checkout = await guestCheckout();
  const ingested = await ingestVerifiedProviderPayment({ payment: approvedPayment(checkout), receiptId: 'receipt-1', expectedLiveMode: false, now: new Date('2026-09-01T12:01:00.000Z') }, db!);
  assert.equal(ingested.validForOrder, true);
  const [first, second] = await Promise.all([
    applyPaymentEvent({ eventId: ingested.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!),
    applyPaymentEvent({ eventId: ingested.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!),
  ]);
  assert.ok(['applied', 'duplicate'].includes(first.outcome));
  assert.ok(['applied', 'duplicate'].includes(second.outcome));
  const order = await db!.collection('orders').doc(checkout.orderId).get();
  const booking = await db!.collection('service_bookings').doc(checkout.bookingIds[0]).get();
  const hold = await db!.collection('booking_holds').doc(String(booking.get('holdId'))).get();
  assert.equal(order.get('state'), 'paid');
  assert.equal(booking.get('state'), 'confirmed');
  assert.equal(booking.get('assignment.state'), 'assigned');
  assert.equal(hold.get('state'), 'consumed');
  const locks = await db!.collection('capacity_slot_locks').get();
  assert.equal(locks.docs.every((lock) => lock.get('kind') === 'booking' && lock.get('ownerId') === checkout.bookingIds[0]), true);
  assert.equal((await db!.collection('outbox_jobs').get()).size, 6);
});

test('approved payment is preserved as paid_needs_resolution when hold expires or professional is suspended', { skip: !hasEmulator }, async () => {
  const expired = await guestCheckout('checkout-expired-001');
  const expiredEvent = await ingestVerifiedProviderPayment({ payment: approvedPayment(expired, { id: '900002' }), receiptId: 'receipt-expired', expectedLiveMode: false, now: new Date('2026-09-01T12:20:00.000Z') }, db!);
  const expiredResult = await applyPaymentEvent({ eventId: expiredEvent.eventId, now: new Date('2026-09-01T12:20:00.000Z') }, db!);
  assert.equal(expiredResult.outcome, 'needs_resolution');
  assert.equal((await db!.collection('orders').doc(expired.orderId).get()).get('state'), 'paid_needs_resolution');
  assert.equal((await db!.collection('service_bookings').doc(expired.bookingIds[0]).get()).get('state'), 'pending_confirmation');

  await clearCollections(); await seedProfessional();
  const suspended = await guestCheckout('checkout-suspended-001');
  await db!.collection('professionals').doc('pro-one').update({ 'lifecycle.operations.state': 'suspended' });
  const suspendedEvent = await ingestVerifiedProviderPayment({ payment: approvedPayment(suspended, { id: '900003' }), receiptId: 'receipt-suspended', expectedLiveMode: false, now: new Date('2026-09-01T12:01:00.000Z') }, db!);
  assert.equal((await applyPaymentEvent({ eventId: suspendedEvent.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!)).outcome, 'needs_resolution');
});

test('amount, currency, reference and environment mismatches never confirm booking', { skip: !hasEmulator }, async () => {
  for (const [suffix, override] of [
    ['amount', { transactionAmount: 1 }], ['currency', { currency: 'USD' }],
    ['reference', { externalReference: 'forged' }], ['environment', { liveMode: true }],
  ] as const) {
    await clearCollections(); await seedProfessional();
    const checkout = await guestCheckout(`checkout-mismatch-${suffix}`);
    const event = await ingestVerifiedProviderPayment({ payment: approvedPayment(checkout, { id: `91${suffix.length}`, ...override }), receiptId: `receipt-${suffix}`, expectedLiveMode: false, now: new Date('2026-09-01T12:01:00.000Z') }, db!);
    assert.equal(event.validForOrder, false);
    assert.equal((await db!.collection('service_bookings').doc(checkout.bookingIds[0]).get()).get('state'), 'pending_confirmation');
  }
});

test('older events are ignored and outbox retries safely through the local mock adapter', { skip: !hasEmulator }, async () => {
  const checkout = await guestCheckout();
  const approved = await ingestVerifiedProviderPayment({ payment: approvedPayment(checkout), receiptId: 'receipt-new', expectedLiveMode: false, now: new Date('2026-09-01T12:01:00.000Z') }, db!);
  await applyPaymentEvent({ eventId: approved.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!);
  const older = await ingestVerifiedProviderPayment({ payment: approvedPayment(checkout, { status: 'pending', updatedAt: '2026-09-01T11:59:00.000Z' }), receiptId: 'receipt-old', expectedLiveMode: false, now: new Date('2026-09-01T12:02:00.000Z') }, db!);
  assert.equal((await applyPaymentEvent({ eventId: older.eventId, now: new Date('2026-09-01T12:02:00.000Z') }, db!)).outcome, 'ignored');
  const effects = await processOutboxJobs({ workerId: 'test', now: new Date('2026-09-01T12:03:00.000Z'), adapters: createExternalEffectAdapter({ EXTERNAL_EFFECTS_MODE: 'mock', FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST, GCLOUD_PROJECT: 'demo-metodo-pame' }) }, db!);
  assert.equal(effects.succeeded, 6);
  assert.equal((await db!.collection('outbox_jobs').where('state', '==', 'succeeded').get()).size, 6);
});

test('Preview WhatsApp mock is allowlisted, deterministic and never calls Meta', { skip: !hasEmulator }, async () => {
  const checkout = await guestCheckout('checkout-preview-whatsapp-mock-001');
  const approved = await ingestVerifiedProviderPayment({ payment: approvedPayment(checkout, { id: '900041' }), receiptId: 'receipt-preview-whatsapp-mock', expectedLiveMode: false, now: new Date('2026-09-01T12:01:00.000Z') }, db!);
  await applyPaymentEvent({ eventId: approved.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!);
  const jobs = await db!.collection('outbox_jobs').get();
  for (const job of jobs.docs) if (job.get('kind') !== 'whatsapp.booking_event') await job.ref.delete();
  const adapter = createExternalEffectAdapter({
    EXTERNAL_EFFECTS_MODE: 'sandbox', VERCEL_ENV: 'preview', WHATSAPP_ADAPTER_MODE: 'mock',
    EXTERNAL_EFFECTS_SANDBOX_PHONE_ALLOWLIST: baseInput.clientPhone,
  });
  const result = await processOutboxJobs({ workerId: 'preview-whatsapp-mock', now: new Date('2026-09-01T12:03:00.000Z'), adapters: adapter }, db!);
  assert.equal(result.succeeded, 1);
  const job = (await db!.collection('outbox_jobs').get()).docs[0];
  assert.match(String(job.get('providerReference')), /^whatsapp_mock:[a-f0-9]{24}$/);

  await job.ref.update({ state: 'pending', nextAttemptAt: Timestamp.fromDate(new Date('2026-09-01T12:03:00.000Z')) });
  const privateOrder = await db!.collection('order_private').doc(checkout.orderId).get();
  await privateOrder.ref.update({ phone: '5500000000001' });
  const rejected = await processOutboxJobs({ workerId: 'preview-whatsapp-mock', now: new Date('2026-09-01T12:04:00.000Z'), adapters: adapter }, db!);
  assert.equal(rejected.retryable, 1);
  assert.equal((await job.ref.get()).get('lastErrorCode'), 'EXTERNAL_EFFECT_SANDBOX_TARGET_REQUIRED');
});

test('Preview Resend adapter accepts only the official allowlisted test recipient', { skip: !hasEmulator }, async () => {
  const checkout = await guestCheckout('checkout-preview-resend-001');
  const approved = await ingestVerifiedProviderPayment({ payment: approvedPayment(checkout, { id: '900042' }), receiptId: 'receipt-preview-resend', expectedLiveMode: false, now: new Date('2026-09-01T12:01:00.000Z') }, db!);
  await applyPaymentEvent({ eventId: approved.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!);
  for (const job of (await db!.collection('outbox_jobs').get()).docs) if (job.get('kind') !== 'email.booking_confirmed') await job.ref.delete();
  await db!.collection('order_private').doc(checkout.orderId).update({ email: 'delivered+r7@resend.dev' });
  const calls: Array<{ url: string; body: string }> = [];
  const adapter = createExternalEffectAdapter({
    EXTERNAL_EFFECTS_MODE: 'sandbox', RESEND_API_KEY: 'r7-test-key', RESEND_FROM_EMAIL: 'onboarding@resend.dev',
    EXTERNAL_EFFECTS_SANDBOX_EMAIL_ALLOWLIST: 'delivered+r7@resend.dev',
  }, async (url, init) => { calls.push({ url: String(url), body: String(init?.body) }); return new Response(JSON.stringify({ id: 'email-r7-test' }), { status: 200 }); });
  assert.equal((await processOutboxJobs({ workerId: 'preview-resend', now: new Date('2026-09-01T12:03:00.000Z'), adapters: adapter }, db!)).succeeded, 1);
  assert.equal(calls.length, 1); assert.match(calls[0].url, /api\.resend\.com\/emails/); assert.match(calls[0].body, /delivered\+r7@resend\.dev/);
});

test('Preview Calendar adapter is allowlisted and persists one provider reference per job', { skip: !hasEmulator }, async () => {
  const checkout = await guestCheckout('checkout-preview-calendar-001');
  const approved = await ingestVerifiedProviderPayment({ payment: approvedPayment(checkout, { id: '900043' }), receiptId: 'receipt-preview-calendar', expectedLiveMode: false, now: new Date('2026-09-01T12:01:00.000Z') }, db!);
  await applyPaymentEvent({ eventId: approved.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!);
  for (const job of (await db!.collection('outbox_jobs').get()).docs) if (job.get('kind') !== 'calendar.booking_upsert') await job.ref.delete();
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const calendarId = 'metodo-pame-r7-test@group.calendar.google.com';
  const calls: string[] = [];
  const adapter = createExternalEffectAdapter({
    EXTERNAL_EFFECTS_MODE: 'sandbox', GOOGLE_CALENDAR_ID: calendarId,
    GOOGLE_SERVICE_ACCOUNT_KEY: JSON.stringify({ client_email: 'r7-test@project.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }),
    EXTERNAL_EFFECTS_SANDBOX_CALENDAR_ALLOWLIST: calendarId,
  }, async (url) => { calls.push(String(url)); return calls.length === 1 ? new Response(JSON.stringify({ access_token: 'test-token' }), { status: 200 }) : new Response(JSON.stringify({ id: 'calendar-r7-test' }), { status: 200 }); });
  const processed = await processOutboxJobs({ workerId: 'preview-calendar', now: new Date('2026-09-01T12:03:00.000Z'), adapters: adapter }, db!);
  assert.equal(processed.succeeded, 1, JSON.stringify({ processed, job: (await db!.collection('outbox_jobs').get()).docs[0].data() }));
  const job = (await db!.collection('outbox_jobs').get()).docs[0];
  assert.equal(job.get('providerReference'), 'calendar:calendar-r7-test'); assert.equal(calls.length, 2);
});

test('R7 Preview webhook records only signed TEST evidence and is idempotent without commercial artifacts', { skip: !hasEmulator }, async () => {
  const identity = { paymentId: '900071', requestId: 'provider-request-r7', signature: 'verified-by-handler', receiptId: 'receipt-r7-test' };
  const provider = {
    getPayment: async () => ({
      id: identity.paymentId, status: 'approved', externalReference: R7_TEST_WEBHOOK_FIXTURE_ID,
      transactionAmount: 5, currency: 'BRL', liveMode: true, collectorId: '3648917580', updatedAt: '2026-09-05T12:01:00.000Z',
    }),
  };
  const env = {
    VERCEL_ENV: 'preview', R7_TEST_MODE: 'enabled', PAYMENTS_MODE: 'disabled',
    MP_EXPECTED_LIVE_MODE: 'false', MP_TEST_SELLER_ID: '3648917580', MP_ACCESS_TOKEN: 'test', MP_WEBHOOK_SECRET: 'test',
  };
  const first = await processR7PreviewTestWebhook({ identity, topic: 'payment', action: 'payment.updated', provider, env, now: new Date('2026-09-05T12:01:00.000Z') }, db!);
  const replay = await processR7PreviewTestWebhook({ identity, topic: 'payment', action: 'payment.updated', provider, env, now: new Date('2026-09-05T12:02:00.000Z') }, db!);
  assert.deepEqual(first, { duplicate: false, ignored: false });
  assert.deepEqual(replay, { duplicate: true, ignored: false });
  const receipt = await db!.collection('r7_test_webhook_receipts').doc(identity.receiptId).get();
  assert.equal(receipt.get('testMarker'), 'R7_TEST');
  assert.equal(receipt.get('providerPaymentId'), identity.paymentId);
  assert.equal(receipt.get('collectorId'), '3648917580');
  for (const collection of ['orders', 'payment_attempts', 'payment_events', 'service_bookings', 'booking_holds', 'capacity_slot_locks', 'outbox_jobs']) {
    assert.equal((await db!.collection(collection).get()).size, 0, collection);
  }
});

test('R7 Preview webhook ignores a signed payment that is not the exact TEST fixture', { skip: !hasEmulator }, async () => {
  const identity = { paymentId: '900072', requestId: 'provider-request-other', signature: 'verified-by-handler', receiptId: 'receipt-r7-other' };
  const result = await processR7PreviewTestWebhook({
    identity, topic: 'payment',
    provider: { getPayment: async () => ({
      id: identity.paymentId, status: 'approved', externalReference: 'not-r7-fixture', transactionAmount: 5,
      currency: 'BRL', liveMode: false, collectorId: '3648917580', updatedAt: '2026-09-05T12:01:00.000Z',
    }) },
    env: {
      VERCEL_ENV: 'preview', R7_TEST_MODE: 'enabled', PAYMENTS_MODE: 'disabled',
      MP_EXPECTED_LIVE_MODE: 'false', MP_TEST_SELLER_ID: '3648917580', MP_ACCESS_TOKEN: 'test', MP_WEBHOOK_SECRET: 'test',
    },
  }, db!);
  assert.deepEqual(result, { duplicate: false, ignored: true });
  assert.equal((await db!.collection('r7_test_webhook_receipts').get()).size, 0);
});

test('webhook replay and reconciliation are idempotent', { skip: !hasEmulator }, async () => {
  const checkout = await guestCheckout();
  const payment = approvedPayment(checkout, { id: '900010' });
  const identity = { paymentId: payment.id, requestId: 'provider-request-10', signature: 'verified-by-handler', receiptId: 'receipt-replay-10' };
  const provider = { getPayment: async () => payment };
  const first = await processMercadoPagoWebhook({ identity, topic: 'payment', action: 'payment.updated', provider, expectedLiveMode: false, now: new Date('2026-09-01T12:01:00.000Z') }, db!);
  const replay = await processMercadoPagoWebhook({ identity, topic: 'payment', action: 'payment.updated', provider, expectedLiveMode: false, now: new Date('2026-09-01T12:01:01.000Z') }, db!);
  assert.equal(first.outcome, 'applied');
  assert.equal(replay.duplicate, true);
  assert.equal((await db!.collection('payment_events').get()).size, 1);
  assert.equal((await db!.collection('outbox_jobs').get()).size, 6);

  await db!.collection('payment_attempts').doc(checkout.attemptId).update({
    state: 'unknown', providerPaymentId: payment.id, updatedAt: Timestamp.fromDate(new Date('2026-09-01T12:02:00.000Z')),
  });
  const reconciled = await reconcilePayments({ provider, expectedLiveMode: false, now: new Date('2026-09-01T12:03:00.000Z') }, db!);
  assert.equal(reconciled.checked, 1);
  assert.equal(reconciled.errors, 0);
  assert.equal((await db!.collection('outbox_jobs').get()).size, 6);
});

test('monthly checkout confirms all four bookings atomically and emits deterministic effects', { skip: !hasEmulator }, async () => {
  const checkout = await prepareCheckout({
    ...baseInput,
    mode: 'mensal',
    idempotencyKey: 'checkout-monthly-001',
    requestId: 'request-monthly-001',
  }, db!, { guestSecret: 'g'.repeat(32), guestTtlSeconds: 900, holdTtlSeconds: 900 });
  await attachPreference({
    orderId: checkout.orderId,
    attemptId: checkout.attemptId,
    preference: { id: `preference-${checkout.attemptId}`, initPoint: 'https://sandbox.example.test/checkout' },
    now: baseInput.now,
  }, db!);
  assert.equal(checkout.bookingIds.length, 4);

  const event = await ingestVerifiedProviderPayment({
    payment: approvedPayment(checkout, { id: '900020' }),
    receiptId: 'receipt-monthly',
    expectedLiveMode: false,
    now: new Date('2026-09-01T12:01:00.000Z'),
  }, db!);
  assert.equal((await applyPaymentEvent({ eventId: event.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!)).outcome, 'applied');

  for (const bookingId of checkout.bookingIds) {
    assert.equal((await db!.collection('service_bookings').doc(bookingId).get()).get('state'), 'confirmed');
  }
  assert.equal((await db!.collection('outbox_jobs').get()).size, 24);
});

test('a second approved provider payment is preserved for human resolution', { skip: !hasEmulator }, async () => {
  const checkout = await guestCheckout('checkout-double-payment-001');
  const first = await ingestVerifiedProviderPayment({
    payment: approvedPayment(checkout, { id: '900030' }),
    receiptId: 'receipt-first-payment', expectedLiveMode: false,
    now: new Date('2026-09-01T12:01:00.000Z'),
  }, db!);
  await applyPaymentEvent({ eventId: first.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!);

  const second = await ingestVerifiedProviderPayment({
    payment: approvedPayment(checkout, { id: '900031', updatedAt: '2026-09-01T12:02:00.000Z' }),
    receiptId: 'receipt-second-payment', expectedLiveMode: false,
    now: new Date('2026-09-01T12:02:00.000Z'),
  }, db!);
  assert.equal((await applyPaymentEvent({ eventId: second.eventId, now: new Date('2026-09-01T12:02:01.000Z') }, db!)).outcome, 'needs_resolution');
  assert.equal((await db!.collection('orders').doc(checkout.orderId).get()).get('state'), 'paid_needs_resolution');
  assert.equal((await db!.collection('payment_reconciliation_issues').doc(second.eventId).get()).get('requiresHumanReview'), true);
});

test('external effect failure is retryable and never rolls back an approved payment', { skip: !hasEmulator }, async () => {
  const checkout = await guestCheckout('checkout-outbox-failure-001');
  const event = await ingestVerifiedProviderPayment({
    payment: approvedPayment(checkout, { id: '900040' }),
    receiptId: 'receipt-outbox-failure', expectedLiveMode: false,
    now: new Date('2026-09-01T12:01:00.000Z'),
  }, db!);
  await applyPaymentEvent({ eventId: event.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!);
  const result = await processOutboxJobs({
    workerId: 'failing-worker', now: new Date('2026-09-01T12:03:00.000Z'),
    adapters: { execute: async () => { throw new Error('provider unavailable'); } },
  }, db!);
  assert.equal(result.retryable, 6);
  assert.equal((await db!.collection('orders').doc(checkout.orderId).get()).get('state'), 'paid');
  assert.equal((await db!.collection('service_bookings').doc(checkout.bookingIds[0]).get()).get('state'), 'confirmed');
  assert.equal((await db!.collection('outbox_jobs').where('state', '==', 'retryable').get()).size, 6);
});

test('outbox reaches dead_letter after bounded retries without changing the paid booking', { skip: !hasEmulator }, async () => {
  const checkout = await guestCheckout('checkout-outbox-dead-letter-001');
  const event = await ingestVerifiedProviderPayment({
    payment: approvedPayment(checkout, { id: '900044' }),
    receiptId: 'receipt-outbox-dead-letter', expectedLiveMode: false,
    now: new Date('2026-09-01T12:01:00.000Z'),
  }, db!);
  await applyPaymentEvent({ eventId: event.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!);
  for (const job of (await db!.collection('outbox_jobs').get()).docs) if (job.get('kind') !== 'calendar.booking_upsert') await job.ref.delete();
  const failing = { execute: async () => { throw new Error('provider permanently unavailable'); } };
  const times = [
    '2026-09-01T12:03:00.000Z', '2026-09-01T12:05:00.000Z', '2026-09-01T12:09:00.000Z',
    '2026-09-01T12:17:00.000Z', '2026-09-01T12:33:00.000Z',
  ];
  for (const value of times) await processOutboxJobs({ workerId: 'dead-letter-worker', now: new Date(value), adapters: failing }, db!);
  const job = (await db!.collection('outbox_jobs').get()).docs[0];
  assert.equal(job.get('state'), 'dead_letter');
  assert.equal(job.get('attempts'), 5);
  assert.equal((await db!.collection('orders').doc(checkout.orderId).get()).get('state'), 'paid');
  assert.equal((await db!.collection('service_bookings').doc(checkout.bookingIds[0]).get()).get('state'), 'confirmed');
});

test('synthetic reminder and address-reveal jobs respect run time, deduplicate and execute through the outbox', { skip: !hasEmulator }, async () => {
  const checkout = await guestCheckout('checkout-r7-scheduled-effects-001');
  const event = await ingestVerifiedProviderPayment({
    payment: approvedPayment(checkout, { id: '900045' }),
    receiptId: 'receipt-r7-scheduled-effects', expectedLiveMode: false,
    now: new Date('2026-09-01T12:01:00.000Z'),
  }, db!);
  await applyPaymentEvent({ eventId: event.eventId, now: new Date('2026-09-01T12:01:01.000Z') }, db!);
  const scheduledKinds = new Set(['booking.reminder_schedule', 'booking.address_reveal_schedule']);
  for (const job of (await db!.collection('outbox_jobs').get()).docs) {
    if (!scheduledKinds.has(String(job.get('kind')))) await job.ref.delete();
    else await job.ref.update({ nextAttemptAt: Timestamp.fromDate(new Date('2026-09-01T13:00:00.000Z')) });
  }
  const adapter = { execute: async (job: FirebaseFirestore.DocumentData) => ({ providerReference: `r7_test:${job.dedupeKey}` }) };
  assert.equal((await processOutboxJobs({ workerId: 'r7-before-due', now: new Date('2026-09-01T12:59:59.000Z'), adapters: adapter }, db!)).succeeded, 0);
  assert.equal((await db!.collection('outbox_jobs').get()).size, 2);
  assert.equal((await processOutboxJobs({ workerId: 'r7-due', now: new Date('2026-09-01T13:00:00.000Z'), adapters: adapter }, db!)).succeeded, 2);
  const jobs = await db!.collection('outbox_jobs').get();
  assert.equal(jobs.docs.filter((job) => job.get('state') === 'succeeded').length, 2);
  assert.equal((await processOutboxJobs({ workerId: 'r7-repeat', now: new Date('2026-09-01T13:01:00.000Z'), adapters: adapter }, db!)).succeeded, 0);
});
