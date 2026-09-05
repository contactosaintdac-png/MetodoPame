import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnoseR7Payment, diagnoseR7Preference, sanitizeR7Payment, sanitizeR7Preference } from '../../api/_lib/payments/r7-preference-diagnostic.js';

const id = '3648917580-0daf1f15-0de0-43bf-8d28-6b9285cd39a9';
const env = { VERCEL_ENV: 'preview', R7_TEST_MODE: 'enabled', MP_TEST_SELLER_ID: '3648917580', MP_EXPECTED_LIVE_MODE: 'false', PAYMENTS_MODE: 'disabled', MP_ACCESS_TOKEN: 'synthetic-secret' };
const auth = {
  authenticate: async () => ({ uid: 'test-owner', emailVerified: true }),
  authorize: async () => ({ uid: 'test-owner', roles: ['owner'], authzSource: 'access_grant' as const }),
};
const req = { headers: { authorization: 'Bearer synthetic-owner-token' } };

test('diagnostic uses one GET to only the fixed Preference, never follows redirects or sends request body', async () => {
  let calls = 0;
  const result = await diagnoseR7Preference(req, env, { auth, fetch: async (url, options) => {
    calls++;
    assert.equal(url, `https://api.mercadopago.com/checkout/preferences/${id}`);
    assert.equal(options?.method, 'GET');
    assert.equal(options?.body, undefined);
    assert.equal(options?.redirect, 'error');
    return Response.json({ id, collector_id: 3648917580, live_mode: false, payer: { email: 'private@example.test' } });
  } });
  assert.equal(calls, 1);
  assert.equal(result.providerHttpStatus, 200);
  assert.equal(JSON.stringify(result).includes('private@example'), false);
});

test('production, disabled TEST, invalid identity, non-owner and legacy owner never reach provider', async () => {
  const variants = [
    { environment: { ...env, VERCEL_ENV: 'production' }, auth },
    { environment: { ...env, R7_TEST_MODE: 'disabled' }, auth },
    { environment: env, auth: { ...auth, authenticate: async () => { throw new Error('invalid'); } } },
    { environment: env, auth: { ...auth, authorize: async () => ({ uid: 'test-owner', roles: ['client'], authzSource: 'access_grant' as const }) } },
    { environment: env, auth: { ...auth, authorize: async () => ({ uid: 'test-owner', roles: ['owner'], authzSource: 'legacy_email' as const }) } },
  ];
  for (const variant of variants) {
    let calls = 0;
    await assert.rejects(() => diagnoseR7Preference({ headers: {} }, variant.environment, { auth: variant.auth, fetch: async () => { calls++; return Response.json({}); } }));
    assert.equal(calls, 0);
  }
});

test('arbitrary IDs and unsafe TEST configuration are rejected before provider access', async () => {
  for (const variant of [
    { request: { ...req, body: { id: 'other-id' } }, environment: env },
    { request: { ...req, query: { id: 'other-id' } }, environment: env },
    { request: req, environment: { ...env, MP_TEST_SELLER_ID: 'other' } },
    { request: req, environment: { ...env, MP_EXPECTED_LIVE_MODE: 'true' } },
    { request: req, environment: { ...env, PAYMENTS_MODE: 'production' } },
  ]) {
    let calls = 0;
    await assert.rejects(() => diagnoseR7Preference(variant.request, variant.environment, { auth, fetch: async () => { calls++; return Response.json({}); } }));
    assert.equal(calls, 0);
  }
});

test('sanitizer preserves restrictions and missing live_mode, removes PII, URL secrets and nested provider data', () => {
  const result = sanitizeR7Preference({
    id, payer: { email: 'private@example.test', identification: { number: 'secret-document' } },
    items: [{ title: 'private-name', id: 'private-id', quantity: 1, unit_price: 5, currency_id: 'BRL' }],
    payment_methods: { installments: 1, excluded_payment_types: [{ id: 'credit_card', email: 'private@example.test' }], unknown: 'synthetic-secret' },
    back_urls: { success: 'https://example.test/?token=synthetic-secret' },
    metadata: { r7_test: true, access_token: 'synthetic-secret' },
    shipments: { receiver_address: { street_name: 'private-street' } },
    warnings: [{ code: 'account_restricted', message: 'private-name' }],
    init_point: 'https://example.test/?token=synthetic-secret', expires: false, expiration_date_to: null,
  });
  assert.equal(Object.hasOwn(result, 'live_mode'), false);
  assert.deepEqual(result.payment_methods, { installments: 1, excluded_payment_types: [{ id: 'credit_card' }] });
  assert.equal(result.expires, false);
  assert.equal(result.init_point_present, true);
  assert.equal(/private-name|private-id|private-street|private@example|synthetic-secret|secret-document/.test(JSON.stringify(result)), false);
});

test('provider errors, network failures and mismatched responses never expose raw messages or credentials', async () => {
  for (const provider of [
    async () => Response.json({ error: 'invalid_access_token', message: 'synthetic-secret', payer: { email: 'private@example.test' } }, { status: 401 }),
    async () => { throw new Error('synthetic-secret'); },
    async () => Response.json({ id: 'wrong-id', collector_id: 999 }),
  ]) {
    const result = await diagnoseR7Preference(req, env, { auth, fetch: provider });
    assert.equal('preference' in result, false);
    assert.equal(/synthetic-secret|private@example/.test(JSON.stringify(result)), false);
  }
});

test('payment diagnostic reads only the fixed approved R7 payment and removes payer/card data', async () => {
  let calls = 0;
  const result = await diagnoseR7Payment(req, env, { auth, fetch: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.mercadopago.com/v1/payments/177478228692');
    assert.equal(options?.method, 'GET');
    assert.equal(options?.body, undefined);
    return Response.json({ id: 177478228692, status: 'approved', transaction_amount: 5, currency_id: 'BRL', live_mode: false, collector_id: 3648917580, external_reference: 'r7_test_owner_checkout_r5_webhook_v1', payer: { email: 'private@example.test' }, card: { last_four_digits: '5682' } });
  } });
  assert.equal(calls, 1);
  assert.equal(result.providerHttpStatus, 200);
  assert.equal(JSON.stringify(result).includes('private@example'), false);
});

test('payment sanitizer never returns card or payer details', () => {
  const result = sanitizeR7Payment({ id: 177478228692, status: 'approved', payer: { email: 'private@example.test' }, card: { last_four_digits: '5682' }, metadata: { secret: 'synthetic-secret' } });
  assert.equal(result.payer_present, true);
  assert.equal(result.card_present, true);
  assert.equal(/private@example|5682|synthetic-secret/.test(JSON.stringify(result)), false);
});
