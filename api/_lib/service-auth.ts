import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest } from '@vercel/node';

import { HttpError } from './http-errors.js';

export interface ServiceActor {
  kind: 'service';
  service: 'vercel-cron';
  permissions: readonly ['system.cron.execute'];
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function secretsMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function authenticateCron(req: VercelRequest): ServiceActor {
  if (req.method !== 'GET') {
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  }

  const expected = process.env.CRON_SECRET;
  if (!expected) {
    throw new HttpError(503, 'SERVICE_AUTH_UNAVAILABLE', 'Service authentication is unavailable');
  }

  const authorization = firstHeader(req.headers.authorization);
  const prefix = 'Bearer ';
  if (!authorization?.startsWith(prefix)) {
    throw new HttpError(401, 'INVALID_SERVICE_CREDENTIAL', 'Invalid service credential');
  }

  const supplied = authorization.slice(prefix.length).trim();
  if (!supplied || !secretsMatch(supplied, expected)) {
    throw new HttpError(401, 'INVALID_SERVICE_CREDENTIAL', 'Invalid service credential');
  }

  return {
    kind: 'service',
    service: 'vercel-cron',
    permissions: ['system.cron.execute'],
  };
}
