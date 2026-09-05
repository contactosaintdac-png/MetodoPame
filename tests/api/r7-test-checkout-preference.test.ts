import assert from 'node:assert/strict';
import test from 'node:test';

import { createR7TestCheckoutPreference, type R7TestCheckoutDependencies } from '../../api/_lib/payments/r7-preview-test-checkout.js';
import { HttpError } from '../../api/_lib/http-errors.js';

function dependencies(overrides: Partial<R7TestCheckoutDependencies> = {}): R7TestCheckoutDependencies {
  return {
    env: {
      PAYMENTS_MODE: 'disabled', PUBLIC_APP_URL: 'https://preview.example', VERCEL_ENV: 'preview', R7_TEST_MODE: 'enabled',
      MP_EXPECTED_LIVE_MODE: 'false', MP_TEST_SELLER_ID: '3648917580', MP_ACCESS_TOKEN: 'test-token', MP_WEBHOOK_SECRET: 'test-webhook-secret',
      VERCEL_AUTOMATION_BYPASS_SECRET: 'preview-bypass-secret',
    },
    createPreference: async () => ({ id: 'pref-r7', init_point: 'https://checkout.example/r7', collector_id: '3648917580' }),
    ...overrides,
  };
}

test('R7 test preference returns only init_point and a server-generated R7_TEST reference', async () => {
  const result = await createR7TestCheckoutPreference(dependencies());
  assert.equal(result.id, 'pref-r7');
  assert.equal(result.init_point, 'https://checkout.example/r7');
  assert.match(result.testId, /^r7_test_checkout_/);
});

test('R7 test preference accepts the fixed R$5 fixture amount with its separate receipt reference', async () => {
  let requestedAmount: number | undefined;
  const result = await createR7TestCheckoutPreference(dependencies({
    testId: 'r7_test_owner_checkout_r5_v1', amount: 5,
    createPreference: async ({ amount }) => {
      requestedAmount = amount;
      return { id: 'pref-r7-r5', init_point: 'https://checkout.example/r7-r5', collector_id: '3648917580' };
    },
  }));
  assert.equal(requestedAmount, 5);
  assert.equal(result.testId, 'r7_test_owner_checkout_r5_v1');
});

test('R7 test webhook fixture uses its own deterministic R$5 receipt reference', async () => {
  const result = await createR7TestCheckoutPreference(dependencies({
    testId: 'r7_test_owner_checkout_r5_webhook_v1', amount: 5,
    createPreference: async () => ({ id: 'pref-r7-r5-webhook', init_point: 'https://checkout.example/r7-r5-webhook', collector_id: '3648917580' }),
  }));
  assert.equal(result.testId, 'r7_test_owner_checkout_r5_webhook_v1');
});

test('R7 test preference sends the webhook through the Preview-only Vercel bypass', async () => {
  let notificationUrl: string | undefined;
  await createR7TestCheckoutPreference(dependencies({
    createPreference: async (input) => {
      notificationUrl = input.notificationUrl;
      return { id: 'pref-r7-webhook', init_point: 'https://checkout.example/r7-webhook', collector_id: '3648917580' };
    },
  }));
  assert.equal(notificationUrl, 'https://preview.example/api/mercadopago-webhook?x-vercel-protection-bypass=preview-bypass-secret');
});

test('R7 test preference fails closed before provider access without the Preview webhook bypass', async () => {
  let providerCalled = false;
  await assert.rejects(() => createR7TestCheckoutPreference(dependencies({
    env: { ...dependencies().env, VERCEL_AUTOMATION_BYPASS_SECRET: '' },
    createPreference: async () => { providerCalled = true; return {}; },
  })), (error: unknown) => error instanceof HttpError && error.code === 'R7_TEST_WEBHOOK_BYPASS_REQUIRED');
  assert.equal(providerCalled, false);
});

test('R7 test preference refuses a commercial payment mode before provider access', async () => {
  let providerCalled = false;
  await assert.rejects(() => createR7TestCheckoutPreference(dependencies({
    env: { ...dependencies().env, PAYMENTS_MODE: 'sandbox' },
    createPreference: async () => { providerCalled = true; return {}; },
  })), (error: unknown) => error instanceof HttpError && error.code === 'R7_TEST_PAYMENT_MODE_REQUIRED');
  assert.equal(providerCalled, false);
});

test('R7 test preference refuses live mode before provider access', async () => {
  let providerCalled = false;
  await assert.rejects(() => createR7TestCheckoutPreference(dependencies({
    env: { ...dependencies().env, MP_EXPECTED_LIVE_MODE: 'true' },
    createPreference: async () => { providerCalled = true; return {}; },
  })), (error: unknown) => error instanceof HttpError && error.code === 'R7_TEST_SANDBOX_REQUIRED');
  assert.equal(providerCalled, false);
});

test('R7 test preference rejects a collector other than the configured TEST seller', async () => {
  await assert.rejects(() => createR7TestCheckoutPreference(dependencies({
    createPreference: async () => ({ id: 'pref-r7', init_point: 'https://checkout.example/r7', collector_id: 'other-seller' }),
  })), (error: unknown) => error instanceof HttpError && error.code === 'PAYMENT_TEST_SELLER_MISMATCH');
});
