import type { VercelRequest, VercelResponse } from '@vercel/node';

import { applyNoStore } from './http-policy.js';
import { HttpError, toHttpError } from './http-errors.js';
import { authenticateCron, type ServiceActor } from './service-auth.js';

export interface DisabledCronDependencies {
  authenticate(req: VercelRequest): ServiceActor;
  requirePaymentEvidence(): never | void;
}

const defaultDependencies: DisabledCronDependencies = {
  authenticate: authenticateCron,
  requirePaymentEvidence: () => {
    throw new HttpError(503, 'PAYMENT_EVIDENCE_UNAVAILABLE', 'Legacy paid cron is disabled');
  },
};

export function createDisabledPaidCronHandler(
  dependencies: DisabledCronDependencies = defaultDependencies,
) {
  return async function disabledPaidCronHandler(req: VercelRequest, res: VercelResponse) {
    applyNoStore(res);
    try {
      dependencies.authenticate(req);
      dependencies.requirePaymentEvidence();
      return res.status(503).json({ error: 'PAYMENT_EVIDENCE_UNAVAILABLE' });
    } catch (error) {
      const httpError = toHttpError(error);
      return res.status(httpError.status).json({ error: httpError.code, message: httpError.message });
    }
  };
}
