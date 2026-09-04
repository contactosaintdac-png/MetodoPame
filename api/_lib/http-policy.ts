import type { VercelRequest, VercelResponse } from '@vercel/node';

import { HttpError } from './http-errors.js';

const DEFAULT_PUBLIC_ORIGINS = [
  'https://metodopame.com',
  'https://www.metodopame.com',
];

function configuredOrigins(): Set<string> {
  const configured = (process.env.PUBLIC_API_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_PUBLIC_ORIGINS, ...configured]);
}

export function applyNoStore(res: VercelResponse): void {
  res.setHeader('Cache-Control', 'no-store');
}

export function applyPublicCors(
  req: VercelRequest,
  res: VercelResponse,
  methods: readonly string[],
): void {
  applyNoStore(res);
  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(','));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-Request-Id, X-Guest-Checkout-Token');

  if (!origin) return;
  if (!configuredOrigins().has(origin)) {
    throw new HttpError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed');
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
}
