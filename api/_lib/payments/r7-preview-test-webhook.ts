import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { getAdminFirestore } from '../firebase-admin.js';
import { HttpError } from '../http-errors.js';
import { readDataModelFlags } from '../data/feature-flags.js';
import { createMercadoPagoPaymentProvider, type PaymentProviderPort } from './mercado-pago-provider.js';
import type { MercadoPagoWebhookIdentity } from './webhook-security.js';

/** This is the one isolated Checkout Pro fixture that may reach this handler. */
export const R7_TEST_WEBHOOK_FIXTURE_ID = 'r7_test_owner_checkout_r5_webhook_v1';

function isR7TestWebhookEnvironment(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV === 'preview'
    && env.R7_TEST_MODE === 'enabled'
    && readDataModelFlags(env).paymentsMode === 'disabled'
    && env.MP_EXPECTED_LIVE_MODE === 'false'
    && /^\d+$/.test(env.MP_TEST_SELLER_ID?.trim() ?? '')
    && Boolean(env.MP_ACCESS_TOKEN?.trim())
    && Boolean(env.MP_WEBHOOK_SECRET?.trim());
}

export function r7TestWebhookProcessingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return isR7TestWebhookEnvironment(env);
}

function assertExpectedR7TestPayment(input: {
  id: string;
  status: string;
  externalReference: string;
  transactionAmount: number;
  currency: string;
  liveMode: boolean;
  collectorId?: string;
}, paymentId: string, env: Record<string, string | undefined>): boolean {
  if (input.id !== paymentId) {
    throw new HttpError(502, 'PAYMENT_PROVIDER_ID_MISMATCH', 'Payment provider returned a different payment');
  }
  // A signed webhook for any other Preview payment is deliberately ignored: it
  // must not use this TEST-only path to create commercial records.
  if (input.externalReference !== R7_TEST_WEBHOOK_FIXTURE_ID) return false;
  const expectedSeller = env.MP_TEST_SELLER_ID!.trim();
  if (input.status !== 'approved'
    || input.transactionAmount !== 5
    || input.currency !== 'BRL'
    || input.liveMode !== false
    || input.collectorId !== expectedSeller) {
    throw new HttpError(502, 'R7_TEST_PAYMENT_MISMATCH', 'R7 test payment verification failed');
  }
  return true;
}

/**
 * Records evidence for the one R7 Preview fixture only.  It intentionally
 * never calls settlement, booking, order, outbox, or reconciliation services.
 */
export async function processR7PreviewTestWebhook(input: {
  identity: MercadoPagoWebhookIdentity;
  topic: string;
  action?: string;
  provider?: PaymentProviderPort;
  env?: Record<string, string | undefined>;
  now?: Date;
}, db: Firestore = getAdminFirestore()): Promise<{ duplicate: boolean; ignored: boolean }> {
  const env = input.env ?? process.env;
  if (!isR7TestWebhookEnvironment(env)) {
    throw new HttpError(404, 'NOT_FOUND', 'Not found');
  }
  if (input.topic !== 'payment') return { duplicate: false, ignored: true };

  const receiptRef = db.collection('r7_test_webhook_receipts').doc(input.identity.receiptId);
  const existing = await receiptRef.get();
  if (existing.exists && existing.get('processingState') === 'processed') {
    return { duplicate: true, ignored: false };
  }

  const payment = await (input.provider ?? createMercadoPagoPaymentProvider()).getPayment(input.identity.paymentId);
  if (!assertExpectedR7TestPayment(payment, input.identity.paymentId, env)) {
    return { duplicate: false, ignored: true };
  }

  const now = Timestamp.fromDate(input.now ?? new Date());
  const result = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(receiptRef);
    if (current.exists && current.get('processingState') === 'processed') return 'duplicate' as const;
    transaction.set(receiptRef, {
      schemaVersion: 1,
      testMarker: 'R7_TEST',
      processingState: 'processed',
      provider: 'mercado_pago',
      providerPaymentId: payment.id,
      providerRequestId: input.identity.requestId,
      topic: input.topic,
      action: input.action ?? '',
      fixtureId: R7_TEST_WEBHOOK_FIXTURE_ID,
      amount: payment.transactionAmount,
      currency: payment.currency,
      collectorId: payment.collectorId,
      liveMode: payment.liveMode,
      providerUpdatedAt: payment.updatedAt,
      createdAt: current.exists ? current.get('createdAt') ?? now : now,
      updatedAt: now,
    }, { merge: true });
    return 'processed' as const;
  });
  return { duplicate: result === 'duplicate', ignored: false };
}
