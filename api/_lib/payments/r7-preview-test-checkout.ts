import { randomUUID } from 'node:crypto';

import type { Firestore } from 'firebase-admin/firestore';
import { MercadoPagoConfig, Preference } from 'mercadopago';

import { getAdminFirestore } from '../firebase-admin.js';
import { HttpError } from '../http-errors.js';
import { readDataModelFlags } from '../data/feature-flags.js';

interface ProviderPreference { id?: string; init_point?: string; collector_id?: string | number }

export interface R7TestCheckoutDependencies {
  env: Record<string, string | undefined>;
  testId?: string;
  createPreference?(input: { appUrl: string; testId: string }): Promise<ProviderPreference>;
}

const OWNER_TEST_RECEIPT_ID = 'r7_test_owner_checkout_v1';

function requiredAppUrl(env: Record<string, string | undefined>): string {
  const value = env.PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!value) throw new HttpError(503, 'CHECKOUT_CONFIG_UNAVAILABLE', 'Checkout configuration is unavailable');
  return value;
}

/**
 * R7 is a deliberately isolated Preview evidence flow. It must never inherit
 * the commercial checkout gate: that gate correctly remains closed until R8.
 */
function assertR7PreviewTestCheckoutConfiguration(env: Record<string, string | undefined>): string {
  if (env.VERCEL_ENV !== 'preview' || env.R7_TEST_MODE !== 'enabled') {
    throw new HttpError(404, 'NOT_FOUND', 'Not found');
  }
  if (readDataModelFlags(env).paymentsMode !== 'disabled') {
    throw new HttpError(503, 'R7_TEST_PAYMENT_MODE_REQUIRED', 'R7 test requires commercial payments to remain disabled');
  }
  if (env.MP_EXPECTED_LIVE_MODE !== 'false') {
    throw new HttpError(503, 'R7_TEST_SANDBOX_REQUIRED', 'R7 Checkout Pro test requires test mode');
  }
  const sellerId = env.MP_TEST_SELLER_ID?.trim();
  if (!sellerId || !/^\d+$/.test(sellerId)) {
    throw new HttpError(503, 'PAYMENT_TEST_SELLER_REQUIRED', 'Test seller configuration is unavailable');
  }
  if (!env.MP_ACCESS_TOKEN?.trim() || !env.MP_WEBHOOK_SECRET?.trim()) {
    throw new HttpError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Payment provider is unavailable');
  }
  return sellerId;
}

function assertR7TestCollector(collectorId: string | number | undefined, sellerId: string): void {
  if (collectorId === undefined || String(collectorId) !== sellerId) {
    throw new HttpError(502, 'PAYMENT_TEST_SELLER_MISMATCH', 'Payment provider collector does not match the configured TEST seller');
  }
}

async function providerPreference(input: { appUrl: string; testId: string }, env: Record<string, string | undefined>): Promise<ProviderPreference> {
  const accessToken = env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new HttpError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Payment provider is unavailable');
  const preference = new Preference(new MercadoPagoConfig({ accessToken, options: { timeout: 5_000 } }));
  return preference.create({
    body: {
      items: [{ id: input.testId, title: 'R7 TEST — Método Pame', unit_price: 1, quantity: 1, currency_id: 'BRL' }],
      back_urls: { success: input.appUrl, failure: input.appUrl, pending: input.appUrl },
      notification_url: `${input.appUrl}/api/mercadopago-webhook`,
      external_reference: input.testId,
      metadata: { r7_test: true, test_id: input.testId, schema_version: 1 },
      statement_descriptor: 'METODO PAME',
    },
    requestOptions: { idempotencyKey: input.testId },
  });
}

/** Preview-only and capability-gated: never creates Método Pame domain data. */
export async function createR7TestCheckoutPreference(
  dependencies: R7TestCheckoutDependencies = { env: process.env },
): Promise<{ id: string; init_point: string; testId: string; collectorId: string }> {
  const sellerId = assertR7PreviewTestCheckoutConfiguration(dependencies.env);
  const testId = dependencies.testId ?? `r7_test_checkout_${randomUUID()}`;
  const provider = await (dependencies.createPreference ?? ((input) => providerPreference(input, dependencies.env)))({ appUrl: requiredAppUrl(dependencies.env), testId });
  if (!provider.id || !provider.init_point) throw new HttpError(502, 'PAYMENT_PROVIDER_ERROR', 'Payment provider returned an invalid preference');
  assertR7TestCollector(provider.collector_id, sellerId);
  // TEST Checkout Pro deliberately returns the regular init_point only.
  return { id: provider.id, init_point: provider.init_point, testId, collectorId: String(provider.collector_id) };
}

/** One server-managed, deterministic Preview fixture for the temporary owner action. */
export async function createOneShotR7OwnerTestCheckoutPreference(
  dependencies: R7TestCheckoutDependencies = { env: process.env },
  db: Firestore = getAdminFirestore(),
): Promise<{ id: string; init_point: string; testId: string; collectorId: string }> {
  const ref = db.collection('r7_test_checkout_receipts').doc(OWNER_TEST_RECEIPT_ID);
  const state = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.data();
    if (existing?.state === 'created') return 'completed' as const;
    if (existing?.state === 'creating') return 'in_progress' as const;
    transaction.set(ref, {
      testMarker: 'R7_TEST', state: 'creating', source: 'temporary_owner_auth',
      testId: OWNER_TEST_RECEIPT_ID, createdAt: new Date(), updatedAt: new Date(),
    }, { merge: true });
    return 'reserved' as const;
  });
  if (state === 'completed') throw new HttpError(404, 'NOT_FOUND', 'Not found');
  if (state === 'in_progress') throw new HttpError(409, 'R7_TEST_IN_PROGRESS', 'R7 test preference is in progress');

  try {
    const result = await createR7TestCheckoutPreference({ ...dependencies, testId: OWNER_TEST_RECEIPT_ID });
    await ref.update({
      state: 'created', preferenceId: result.id, collectorId: result.collectorId,
      initPoint: result.init_point, updatedAt: new Date(),
    });
    return result;
  } catch (error) {
    await ref.update({ state: 'failed', updatedAt: new Date() });
    throw error;
  }
}
