import type { VercelRequest, VercelResponse } from '@vercel/node';

import {
  buildAvailabilityProjection,
  type AvailabilityProjection,
} from './_lib/availability-read-model.js';
import { applyPublicCors } from './_lib/http-policy.js';
import { toHttpError } from './_lib/http-errors.js';
import { enforcePublicRateLimit } from './_lib/rate-limit.js';
import { requireIsoDate } from './_lib/request-validation.js';

export interface AvailabilityDependencies {
  enforceRateLimit(req: VercelRequest): Promise<void>;
  buildProjection(from: string, to: string): Promise<AvailabilityProjection>;
}

const defaultDependencies: AvailabilityDependencies = {
  enforceRateLimit: (req) => enforcePublicRateLimit(req, 'availability', {
    limit: 60,
    windowMs: 60_000,
  }),
  buildProjection: (from, to) => buildAvailabilityProjection(from, to),
};

function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function createAvailabilityHandler(
  dependencies: AvailabilityDependencies = defaultDependencies,
) {
  return async function availabilityHandler(req: VercelRequest, res: VercelResponse) {
    try {
      applyPublicCors(req, res, ['GET']);
      if (req.method === 'OPTIONS') return res.status(204).end();
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
      }

      await dependencies.enforceRateLimit(req);
      const from = requireIsoDate(queryValue(req.query.from), 'from');
      const to = requireIsoDate(queryValue(req.query.to), 'to');
      const availability = await dependencies.buildProjection(from, to);
      return res.status(200).json({ from, to, availability });
    } catch (error) {
      const httpError = toHttpError(error);
      return res.status(httpError.status).json({ error: httpError.code, message: httpError.message });
    }
  };
}

export default createAvailabilityHandler();
