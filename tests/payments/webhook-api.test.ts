import assert from 'node:assert/strict';
import test from 'node:test';

import { createMercadoPagoWebhookHandler } from '../../api/mercadopago-webhook.js';
import { HttpError } from '../../api/_lib/http-errors.js';
import { responseRecorder } from '../api/helpers.js';

test('webhook authenticates before processing and never trusts body payment status', async () => {
  const calls: string[] = [];
  const handler = createMercadoPagoWebhookHandler({
    authenticate: () => {
      calls.push('authenticate');
      return { paymentId: '123', requestId: 'req', signature: 'sig', receiptId: 'receipt' };
    },
    process: async (input) => {
      calls.push(`process:${input.identity.paymentId}:${input.topic}`);
      return { duplicate: false, ignored: false };
    },
    assertProcessingEnabled: () => {},
  });
  const { response, result } = responseRecorder();
  await handler({ method: 'POST', headers: {}, query: { 'data.id': '123' }, body: { type: 'payment', action: 'payment.updated', data: { id: '123' }, live_mode: false } } as never, response as never);
  assert.equal(result.status, 200);
  assert.deepEqual(calls, ['authenticate', 'process:123:payment']);
  assert.equal(JSON.stringify(result.body).includes('approved'), false);
});

test('invalid webhook never reaches provider processing', async () => {
  let processed = false;
  const handler = createMercadoPagoWebhookHandler({
    authenticate: () => { throw new HttpError(401, 'INVALID_WEBHOOK_SIGNATURE', 'invalid'); },
    process: async () => { processed = true; return { duplicate: false, ignored: false }; },
    assertProcessingEnabled: () => {},
  });
  const { response, result } = responseRecorder();
  await handler({ method: 'POST', headers: {}, query: {}, body: { type: 'payment' } } as never, response as never);
  assert.equal(result.status, 401);
  assert.equal(processed, false);
});

test('the R7 Preview fixture bypasses the commercial disabled gate only after signed authentication', async () => {
  const calls: string[] = [];
  const handler = createMercadoPagoWebhookHandler({
    authenticate: () => {
      calls.push('authenticate');
      return { paymentId: '123', requestId: 'req', signature: 'sig', receiptId: 'receipt' };
    },
    process: async () => { throw new Error('commercial processing must stay closed'); },
    processR7Test: async (input) => {
      calls.push(`r7:${input.identity.paymentId}:${input.topic}`);
      return { duplicate: false, ignored: false };
    },
    assertProcessingEnabled: () => { throw new Error('commercial gate must not run'); },
    env: {
      VERCEL_ENV: 'preview', R7_TEST_MODE: 'enabled', PAYMENTS_MODE: 'disabled',
      MP_EXPECTED_LIVE_MODE: 'false', MP_TEST_SELLER_ID: '3648917580', MP_ACCESS_TOKEN: 'test', MP_WEBHOOK_SECRET: 'test',
    },
  });
  const { response, result } = responseRecorder();
  await handler({ method: 'POST', headers: {}, query: { 'data.id': '123' }, body: { type: 'payment' } } as never, response as never);
  assert.equal(result.status, 200);
  assert.deepEqual(calls, ['authenticate', 'r7:123:payment']);
});

test('the R7 fixture path remains closed when its exact Preview configuration is absent', async () => {
  let gateCalls = 0;
  const handler = createMercadoPagoWebhookHandler({
    authenticate: () => ({ paymentId: '123', requestId: 'req', signature: 'sig', receiptId: 'receipt' }),
    process: async () => ({ duplicate: false, ignored: false }),
    processR7Test: async () => { throw new Error('R7 path must remain closed'); },
    assertProcessingEnabled: () => { gateCalls += 1; },
    env: { VERCEL_ENV: 'preview', R7_TEST_MODE: 'disabled', PAYMENTS_MODE: 'disabled' },
  });
  const { response, result } = responseRecorder();
  await handler({ method: 'POST', headers: {}, query: { 'data.id': '123' }, body: { type: 'payment' } } as never, response as never);
  assert.equal(result.status, 200);
  assert.equal(gateCalls, 1);
});
