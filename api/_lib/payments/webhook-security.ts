import { createHash } from 'node:crypto';
import { InvalidWebhookSignatureError, WebhookSignatureValidator } from 'mercadopago';

import { HttpError } from '../http-errors.js';

export interface MercadoPagoWebhookIdentity {
  paymentId: string;
  requestId: string;
  signature: string;
  receiptId: string;
}

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function authenticateMercadoPagoWebhook(input: {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  secret?: string;
  toleranceSeconds?: number;
  now?: () => number;
}): MercadoPagoWebhookIdentity {
  const secret = input.secret ?? process.env.MP_WEBHOOK_SECRET;
  if (!secret) throw new HttpError(503, 'WEBHOOK_AUTH_UNAVAILABLE', 'Webhook authentication is unavailable');
  const paymentId = one(input.query['data.id'] ?? input.query.id);
  const requestId = one(input.headers['x-request-id']);
  const signature = one(input.headers['x-signature']);
  if (!paymentId || !/^\d{1,32}$/.test(paymentId) || !requestId || requestId.length > 200 || !signature || signature.length > 500) {
    throw new HttpError(400, 'INVALID_WEBHOOK', 'Webhook payload is invalid');
  }
  try {
    WebhookSignatureValidator.validate({
      xSignature: signature,
      xRequestId: requestId,
      dataId: paymentId,
      secret,
      toleranceSeconds: input.toleranceSeconds ?? Number(process.env.MP_WEBHOOK_MAX_SKEW_SECONDS || 300),
      ...(input.now ? { now: input.now } : {}),
    });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      throw new HttpError(401, 'INVALID_WEBHOOK_SIGNATURE', 'Webhook signature is invalid');
    }
    throw error;
  }
  return {
    paymentId, requestId, signature,
    receiptId: createHash('sha256').update(`${requestId}:${paymentId}:${signature}`).digest('hex'),
  };
}
