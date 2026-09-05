import type { VercelRequest, VercelResponse } from '@vercel/node';

import { applyNoStore } from './_lib/http-policy.js';
import { HttpError, toHttpError } from './_lib/http-errors.js';
import { processMercadoPagoWebhook } from './_lib/payments/webhook-service.js';
import { processR7PreviewTestWebhook, r7TestWebhookProcessingEnabled } from './_lib/payments/r7-preview-test-webhook.js';
import { authenticateMercadoPagoWebhook } from './_lib/payments/webhook-security.js';
import { assertWebhookProcessingEnabled } from './_lib/payments/rollout-gate.js';
import { rejectUnknownKeys, requireObject } from './_lib/request-validation.js';

export interface MercadoPagoWebhookDependencies {
  authenticate(input: Parameters<typeof authenticateMercadoPagoWebhook>[0]): ReturnType<typeof authenticateMercadoPagoWebhook>;
  process(input: Parameters<typeof processMercadoPagoWebhook>[0]): ReturnType<typeof processMercadoPagoWebhook>;
  processR7Test?(input: Parameters<typeof processR7PreviewTestWebhook>[0]): ReturnType<typeof processR7PreviewTestWebhook>;
  /** Injectable only for isolated handler tests; production reads process.env. */
  env?: Record<string, string | undefined>;
  /** Injectable only for isolated handler tests; production checks the rollout gate. */
  assertProcessingEnabled?(): void;
}

const defaultDependencies: MercadoPagoWebhookDependencies = {
  authenticate: authenticateMercadoPagoWebhook,
  process: (input) => processMercadoPagoWebhook(input),
  processR7Test: (input) => processR7PreviewTestWebhook(input),
  assertProcessingEnabled: () => { assertWebhookProcessingEnabled(); },
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function createMercadoPagoWebhookHandler(dependencies: MercadoPagoWebhookDependencies = defaultDependencies) {
  return async function mercadoPagoWebhookHandler(req: VercelRequest, res: VercelResponse) {
    applyNoStore(res);
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
      const serializedLength = Buffer.byteLength(JSON.stringify(req.body ?? {}));
      if (serializedLength > 16_384) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', 'Webhook payload is too large');
      const body = requireObject(req.body);
      rejectUnknownKeys(body, ['id', 'live_mode', 'type', 'date_created', 'user_id', 'api_version', 'action', 'data']);
      const topic = typeof body.type === 'string' ? body.type : first(req.query.type);
      if (!topic || topic.length > 80) throw new HttpError(400, 'INVALID_WEBHOOK', 'Webhook payload is invalid');
      const identity = dependencies.authenticate({
        headers: req.headers,
        query: req.query,
      });
      const env = dependencies.env ?? process.env;
      if (r7TestWebhookProcessingEnabled(env)) {
        const result = await (dependencies.processR7Test ?? ((input) => processR7PreviewTestWebhook(input)))({
          identity,
          topic,
          ...(typeof body.action === 'string' ? { action: body.action } : {}),
          env,
        });
        return res.status(200).json({ received: true, duplicate: result.duplicate, ignored: result.ignored, r7Test: true });
      }
      (dependencies.assertProcessingEnabled ?? (() => { assertWebhookProcessingEnabled(); }))();
      const result = await dependencies.process({
        identity,
        topic,
        ...(typeof body.action === 'string' ? { action: body.action } : {}),
      });
      return res.status(200).json({ received: true, duplicate: result.duplicate, ignored: result.ignored });
    } catch (error) {
      const httpError = toHttpError(error);
      return res.status(httpError.status).json({ error: httpError.code, message: httpError.message });
    }
  };
}

export default createMercadoPagoWebhookHandler();
