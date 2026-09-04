import { FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';

import { getAdminFirestore } from '../firebase-admin.js';
import { HttpError } from '../http-errors.js';
import { applyPaymentEvent, ingestVerifiedProviderPayment } from './settlement-service.js';
import { createMercadoPagoPaymentProvider, type PaymentProviderPort } from './mercado-pago-provider.js';
import type { MercadoPagoWebhookIdentity } from './webhook-security.js';

export async function processMercadoPagoWebhook(input: {
  identity: MercadoPagoWebhookIdentity;
  topic: string;
  action?: string;
  provider?: PaymentProviderPort;
  expectedLiveMode?: boolean;
  now?: Date;
}, db: Firestore = getAdminFirestore()): Promise<{ duplicate: boolean; ignored: boolean; eventId?: string; outcome?: string }> {
  const now = Timestamp.fromDate(input.now ?? new Date());
  const receiptRef = db.collection('webhook_receipts').doc(input.identity.receiptId);
  const receipt = await db.runTransaction(async (tx) => {
    const existing = await tx.get(receiptRef);
    if (existing.exists && existing.get('processingState') === 'processed') return 'processed' as const;
    if (!existing.exists) {
      tx.create(receiptRef, {
        schemaVersion: 1, provider: 'mercado_pago', providerPaymentId: input.identity.paymentId,
        providerRequestId: input.identity.requestId, topic: input.topic, action: input.action ?? '',
        processingState: 'received', attempts: 0, createdAt: now, updatedAt: now,
      });
    }
    return existing.exists ? 'retry' as const : 'new' as const;
  });
  if (receipt === 'processed') return { duplicate: true, ignored: false };
  if (input.topic !== 'payment') {
    await receiptRef.update({ processingState: 'processed', ignored: true, updatedAt: now });
    return { duplicate: receipt === 'retry', ignored: true };
  }
  try {
    const payment = await (input.provider ?? createMercadoPagoPaymentProvider()).getPayment(input.identity.paymentId);
    if (payment.id !== input.identity.paymentId) throw new HttpError(502, 'PAYMENT_PROVIDER_ID_MISMATCH', 'Payment provider returned a different payment');
    const event = await ingestVerifiedProviderPayment({
      payment, receiptId: input.identity.receiptId,
      ...(input.expectedLiveMode !== undefined ? { expectedLiveMode: input.expectedLiveMode } : {}),
      ...(input.now ? { now: input.now } : {}),
    }, db);
    const applied = event.validForOrder
      ? await applyPaymentEvent({ eventId: event.eventId, ...(input.now ? { now: input.now } : {}) }, db)
      : { outcome: 'needs_resolution' as const };
    await receiptRef.update({ processingState: 'processed', eventId: event.eventId, outcome: applied.outcome, attempts: FieldValue.increment(1), updatedAt: now });
    return { duplicate: receipt === 'retry', ignored: false, eventId: event.eventId, outcome: applied.outcome };
  } catch (error) {
    await receiptRef.update({ processingState: 'retryable', attempts: FieldValue.increment(1), lastErrorCode: error instanceof HttpError ? error.code : 'WEBHOOK_PROCESSING_FAILED', updatedAt: now });
    throw error;
  }
}
