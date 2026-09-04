import assert from 'node:assert/strict';
import test from 'node:test';

import { createR7TestCheckoutPreference, type R7TestCheckoutDependencies } from '../../api/_lib/payments/r7-preview-test-checkout.js';
import { HttpError } from '../../api/_lib/http-errors.js';

function dependencies(overrides: Partial<R7TestCheckoutDependencies> = {}): R7TestCheckoutDependencies {
  return {
    env: {
      PEOPLE_READ_MODE: 'canonical', PROJECTION_READ_MODE: 'on', BOOKING_READ_MODE: 'canonical', BOOKING_WRITE_MODE: 'canonical',
      BOOKING_HOLD_MODE: 'enforced', BOOKING_EFFECTS_MODE: 'payment_verified', PAYMENTS_MODE: 'sandbox', EXTERNAL_EFFECTS_MODE: 'sandbox',
      BOOKING_HOLD_TTL_SECONDS: '900', GUEST_CHECKOUT_INTENT_TTL_SECONDS: '900', GUEST_CHECKOUT_TOKEN_SECRET: 'test-secret-test-secret',
      PUBLIC_APP_URL: 'https://preview.example', VERCEL_ENV: 'preview', MP_EXPECTED_LIVE_MODE: 'false', MP_TEST_SELLER_ID: '3648917580',
      MP_ACCESS_TOKEN: 'test-token', MP_WEBHOOK_SECRET: 'test-webhook-secret',
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

test('R7 test preference refuses non-sandbox configuration before provider access', async () => {
  let providerCalled = false;
  await assert.rejects(() => createR7TestCheckoutPreference(dependencies({
    env: { ...dependencies().env, PAYMENTS_MODE: 'production', MP_EXPECTED_LIVE_MODE: 'true', EXTERNAL_EFFECTS_MODE: 'production' },
    createPreference: async () => { providerCalled = true; return {}; },
  })), (error: unknown) => error instanceof HttpError && error.code === 'R7_TEST_SANDBOX_REQUIRED');
  assert.equal(providerCalled, false);
});

test('R7 test preference rejects a collector other than the configured TEST seller', async () => {
  await assert.rejects(() => createR7TestCheckoutPreference(dependencies({
    createPreference: async () => ({ id: 'pref-r7', init_point: 'https://checkout.example/r7', collector_id: 'other-seller' }),
  })), (error: unknown) => error instanceof HttpError && error.code === 'PAYMENT_TEST_SELLER_MISMATCH');
});
