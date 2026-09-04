import type { VercelRequest, VercelResponse } from '@vercel/node';

import { authenticate } from './_lib/authenticate.js';
import { authorize } from './_lib/authorize.js';
import { getAdminFirestore } from './_lib/firebase-admin.js';
import { HttpError, toHttpError } from './_lib/http-errors.js';
import { applyPublicCors } from './_lib/http-policy.js';
import { authorizeGuestBooking } from './_lib/payments/guest-access.js';
import { enforcePublicRateLimit } from './_lib/rate-limit.js';
import { rejectUnknownKeys, requireObject, requireResourceId } from './_lib/request-validation.js';

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    applyPublicCors(req, res, ['POST']);
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    await enforcePublicRateLimit(req, 'order-status', { limit: 30, windowMs: 60_000 });
    const body = requireObject(req.body);
    rejectUnknownKeys(body, ['orderId']);
    const orderId = requireResourceId(body.orderId, 'orderId');
    const db = getAdminFirestore();
    const order = await db.collection('orders').doc(orderId).get();
    if (!order.exists) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
    const authorization = first(req.headers.authorization);
    if (authorization) {
      const identity = await authenticate(req);
      await authorize(identity, 'bookings.read_own');
      if (order.get('customer.kind') !== 'authenticated' || order.get('customer.clientUid') !== identity.uid) {
        throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
      }
    } else {
      const token = first(req.headers['x-guest-checkout-token']);
      const bookingIds = order.get('bookingIds') as string[];
      if (!token || !bookingIds?.[0]) throw new HttpError(401, 'GUEST_CHECKOUT_TOKEN_REQUIRED', 'Guest checkout token is required');
      const access = await authorizeGuestBooking({ db, bookingId: bookingIds[0], token });
      if (order.get('customer.kind') !== 'guest' || order.get('customer.guestIntentId') !== access.guestIntentId) {
        throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
      }
    }
    const bookingIds = order.get('bookingIds') as string[];
    const bookings = await db.getAll(...bookingIds.map((id) => db.collection('service_bookings').doc(id)));
    return res.status(200).json({
      orderId, state: order.get('state'), paymentState: order.get('payment.state'),
      amount: order.get('amount'),
      bookings: bookings.filter((booking) => booking.exists).map((booking) => ({
        bookingId: booking.id, state: booking.get('state'), date: booking.get('schedule.localDate'), slot: booking.get('schedule.slot'),
      })),
    });
  } catch (error) {
    const httpError = toHttpError(error);
    return res.status(httpError.status).json({ error: httpError.code, message: httpError.message });
  }
}
