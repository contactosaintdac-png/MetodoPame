import type { VercelRequest, VercelResponse } from '@vercel/node';

import type { Permission } from '../../shared/authz.js';
import { authorize, type AuthorizedActor } from './authorize.js';
import { authenticate, type AuthenticatedIdentity } from './authenticate.js';
import { applyNoStore } from './http-policy.js';
import { toHttpError } from './http-errors.js';
import { requireCanonicalApprovedPayment } from './payment-evidence.js';
import { enqueueVerifiedBookingEffect, type OutboxKind } from './payments/outbox-service.js';
import {
  rejectUnknownKeys,
  requireEnum,
  requireIdempotencyKey,
  requireObject,
  requireResourceId,
} from './request-validation.js';

export interface PaidActionDependencies {
  authenticate(req: VercelRequest): Promise<AuthenticatedIdentity>;
  authorize(identity: AuthenticatedIdentity, permission: Permission): Promise<AuthorizedActor>;
  requirePaymentEvidence(bookingId: string): Promise<unknown>;
  enqueueEffect(input: { bookingId: string; kind: OutboxKind; actorUid: string; requestId: string }): Promise<{ jobId: string }>;
}

const defaultDependencies: PaidActionDependencies = {
  authenticate,
  authorize: (identity, permission) => authorize(identity, permission),
  requirePaymentEvidence: (bookingId) => requireCanonicalApprovedPayment(bookingId),
  enqueueEffect: (input) => enqueueVerifiedBookingEffect(input),
};

function effectKind(action: string): OutboxKind {
  if (action === 'Booking confirmation') return 'email.booking_confirmed';
  if (action === 'Professional assignment notification') return 'email.professional_assigned';
  return 'whatsapp.booking_event';
}

export function createPaidBookingActionHandler(
  permission: Permission,
  action: string,
  allowedEvents: readonly string[] = [],
  dependencies: PaidActionDependencies = defaultDependencies,
) {
  return async function paidBookingActionHandler(req: VercelRequest, res: VercelResponse) {
    applyNoStore(res);
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
    }
    try {
      const identity = await dependencies.authenticate(req);
      await dependencies.authorize(identity, permission);
      const body = requireObject(req.body);
      rejectUnknownKeys(body, allowedEvents.length > 0
        ? ['bookingId', 'idempotencyKey', 'event']
        : ['bookingId', 'idempotencyKey']);
      const bookingId = requireResourceId(body.bookingId, 'bookingId');
      requireIdempotencyKey(body.idempotencyKey);
      if (allowedEvents.length > 0) {
        requireEnum(body.event, 'event', allowedEvents);
      }

      await dependencies.requirePaymentEvidence(bookingId);
      const result = await dependencies.enqueueEffect({
        bookingId,
        kind: effectKind(action),
        actorUid: identity.uid,
        requestId: typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : String(body.idempotencyKey),
      });
      return res.status(202).json({ accepted: true, jobId: result.jobId });
    } catch (error) {
      const httpError = toHttpError(error);
      return res.status(httpError.status).json({ error: httpError.code, message: httpError.message });
    }
  };
}
