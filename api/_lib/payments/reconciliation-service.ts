import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { getAdminFirestore } from '../firebase-admin.js';
import { applyPaymentEvent, ingestVerifiedProviderPayment } from './settlement-service.js';
import { createMercadoPagoPaymentProvider, type PaymentProviderPort } from './mercado-pago-provider.js';

export async function reconcilePayments(input: {
  provider?: PaymentProviderPort;
  expectedLiveMode?: boolean;
  now?: Date;
  limit?: number;
}, db: Firestore = getAdminFirestore()): Promise<{ checked: number; applied: number; needsResolution: number; errors: number }> {
  const nowDate = input.now ?? new Date();
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const attempts = await db.collection('payment_attempts')
    .where('state', 'in', ['creating', 'pending', 'unknown', 'error'])
    .orderBy('updatedAt', 'asc').limit(limit).get();
  const provider = input.provider ?? createMercadoPagoPaymentProvider();
  let checked = 0; let applied = 0; let needsResolution = 0; let errors = 0;
  for (const attempt of attempts.docs) {
    const paymentId = attempt.get('providerPaymentId');
    if (!paymentId) continue;
    checked += 1;
    try {
      const payment = await provider.getPayment(String(paymentId));
      const receiptId = `reconcile_${attempt.id}_${Timestamp.fromDate(nowDate).toMillis()}`;
      const event = await ingestVerifiedProviderPayment({
        payment, receiptId,
        ...(input.expectedLiveMode !== undefined ? { expectedLiveMode: input.expectedLiveMode } : {}),
        now: nowDate,
      }, db);
      const outcome = event.validForOrder
        ? await applyPaymentEvent({ eventId: event.eventId, now: nowDate }, db)
        : { outcome: 'needs_resolution' as const };
      if (outcome.outcome === 'applied') applied += 1;
      if (outcome.outcome === 'needs_resolution') needsResolution += 1;
    } catch (error) {
      errors += 1;
      await db.collection('payment_reconciliation_issues').doc(`attempt_${attempt.id}`).set({
        schemaVersion: 1, state: 'open', requiresHumanReview: true, attemptId: attempt.id,
        reasonCodes: ['RECONCILIATION_FETCH_FAILED'], errorCode: error instanceof Error ? error.name : 'UNKNOWN',
        createdAt: Timestamp.fromDate(nowDate), updatedAt: Timestamp.fromDate(nowDate),
      }, { merge: true });
    }
  }
  return { checked, applied, needsResolution, errors };
}
