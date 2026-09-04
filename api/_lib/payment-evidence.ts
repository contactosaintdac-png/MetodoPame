import type { Firestore } from 'firebase-admin/firestore';

import { getAdminFirestore } from './firebase-admin.js';
import { HttpError } from './http-errors.js';

export interface CanonicalPaymentEvidence {
  bookingId: string;
  orderId: string;
  attemptId: string;
  providerPaymentId: string;
}

export async function requireCanonicalApprovedPayment(
  bookingId: string,
  db: Firestore = getAdminFirestore(),
): Promise<CanonicalPaymentEvidence> {
  const booking = await db.collection('service_bookings').doc(bookingId).get();
  if (!booking.exists || booking.get('state') !== 'confirmed' || booking.get('payment.state') !== 'approved' || !booking.get('payment.orderId')) {
    throw new HttpError(409, 'PAYMENT_EVIDENCE_REQUIRED', 'Verified payment is required');
  }
  const orderId = String(booking.get('payment.orderId'));
  const order = await db.collection('orders').doc(orderId).get();
  if (!order.exists || order.get('state') !== 'paid' || order.get('payment.state') !== 'approved'
      || !order.get('payment.attemptId') || !order.get('payment.providerPaymentId')) {
    throw new HttpError(409, 'PAYMENT_EVIDENCE_REQUIRED', 'Verified payment is required');
  }
  const attemptId = String(order.get('payment.attemptId'));
  const providerPaymentId = String(order.get('payment.providerPaymentId'));
  const [attempt, event] = await Promise.all([
    db.collection('payment_attempts').doc(attemptId).get(),
    db.collection('payment_events').where('providerPaymentId', '==', providerPaymentId)
      .where('processingState', '==', 'applied').limit(1).get(),
  ]);
  if (!attempt.exists || attempt.get('state') !== 'approved' || attempt.get('providerPaymentId') !== providerPaymentId || event.empty) {
    throw new HttpError(409, 'PAYMENT_EVIDENCE_REQUIRED', 'Verified payment is required');
  }
  return { bookingId, orderId, attemptId, providerPaymentId };
}
