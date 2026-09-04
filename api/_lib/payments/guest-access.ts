import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { HttpError } from '../http-errors.js';

export function guestIntentTtlSeconds(env: Record<string, string | undefined> = process.env): number {
  const value = Number(env.GUEST_CHECKOUT_INTENT_TTL_SECONDS);
  if (!Number.isInteger(value) || value < 300 || value > 3_600) {
    throw new HttpError(503, 'GUEST_CHECKOUT_TTL_NOT_CONFIGURED', 'Guest checkout TTL is not configured');
  }
  return value;
}

export function requireGuestTokenSecret(env: Record<string, string | undefined> = process.env): string {
  const value = env.GUEST_CHECKOUT_TOKEN_SECRET;
  if (!value || Buffer.byteLength(value) < 32) {
    throw new HttpError(503, 'GUEST_CHECKOUT_SECRET_NOT_CONFIGURED', 'Guest checkout is unavailable');
  }
  return value;
}

export function deriveGuestToken(secret: string, idempotencyKey: string, payloadHash: string): string {
  return createHmac('sha256', secret)
    .update(`metodo-pame:guest-checkout:v1:${idempotencyKey}:${payloadHash}`)
    .digest('base64url');
}

export function guestTokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function guestIntentId(idempotencyKey: string, payloadHash: string): string {
  return createHash('sha256')
    .update(`guest-intent:${idempotencyKey}:${payloadHash}`)
    .digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function authorizeGuestBooking(input: {
  db: Firestore;
  bookingId: string;
  token: string;
  now?: Date;
}): Promise<{ guestIntentId: string }> {
  const booking = await input.db.collection('service_bookings').doc(input.bookingId).get();
  if (!booking.exists || typeof booking.get('guestIntentId') !== 'string') {
    throw new HttpError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  }
  const intentId = String(booking.get('guestIntentId'));
  const intent = await input.db.collection('guest_purchase_intents').doc(intentId).get();
  const expiresAt = intent.get('expiresAt');
  const expiry = expiresAt instanceof Timestamp ? expiresAt.toDate() : null;
  if (!intent.exists || intent.get('bookingIds')?.includes(input.bookingId) !== true
      || intent.get('state') === 'expired' || intent.get('state') === 'revoked'
      || !expiry || expiry.getTime() <= (input.now ?? new Date()).getTime()
      || !safeEqual(String(intent.get('tokenHash') ?? ''), guestTokenHash(input.token))) {
    throw new HttpError(403, 'GUEST_CHECKOUT_ACCESS_DENIED', 'Guest checkout access denied');
  }
  return { guestIntentId: intentId };
}
