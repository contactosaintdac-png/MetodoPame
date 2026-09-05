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
  amount?: 1 | 5;
  createPreference?(input: { appUrl: string; notificationUrl: string; testId: string; amount: 1 | 5 }): Promise<ProviderPreference>;
}

const OWNER_TEST_RECEIPT_ID = 'r7_test_owner_checkout_v1';
const OWNER_TEST_R5_RECEIPT_ID = 'r7_test_owner_checkout_r5_v1';

function requiredAppUrl(env: Record<string, string | undefined>): string {
  const value = env.PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!value) throw new HttpError(503, 'CHECKOUT_CONFIG_UNAVAILABLE', 'Checkout configuration is unavailable');
  return value;
}

/**
 * Preview is protected by Vercel Authentication. Mercado Pago cannot attach
 * that browser session, so the TEST-only Preference must use Vercel's scoped
 * automation bypass. The secret is never persisted or returned to a client.
 */
function requiredPreviewWebhookUrl(appUrl: string, env: Record<string, string | undefined>): string {
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!bypass) {
    throw new HttpError(503, 'R7_TEST_WEBHOOK_BYPASS_REQUIRED', 'R7 test webhook protection is unavailable');
  }
  return `${appUrl}/api/mercadopago-webhook?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
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

async function providerPreference(input: { appUrl: string; notificationUrl: string; testId: string; amount: 1 | 5 }, env: Record<string, string | undefined>): Promise<ProviderPreference> {
  const accessToken = env.MP_ACCESS_TOKEN;
  if (!accessToken) throw new HttpError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Payment provider is unavailable');
  const preference = new Preference(new MercadoPagoConfig({ accessToken, options: { timeout: 5_000 } }));
  return preference.create({
    body: {
      items: [{ id: input.testId, title: 'R7 TEST — Método Pame', unit_price: input.amount, quantity: 1, currency_id: 'BRL' }],
      back_urls: { success: input.appUrl, failure: input.appUrl, pending: input.appUrl },
      notification_url: input.notificationUrl,
      external_reference: input.testId,
      metadata: { r7_test: true, test_id: input.testId, amount_brl: input.amount, schema_version: 1 },
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
  const amount = dependencies.amount ?? 1;
  const appUrl = requiredAppUrl(dependencies.env);
  const notificationUrl = requiredPreviewWebhookUrl(appUrl, dependencies.env);
  const provider = await (dependencies.createPreference ?? ((input) => providerPreference(input, dependencies.env)))({ appUrl, notificationUrl, testId, amount });
  if (!provider.id || !provider.init_point) throw new HttpError(502, 'PAYMENT_PROVIDER_ERROR', 'Payment provider returned an invalid preference');
  assertR7TestCollector(provider.collector_id, sellerId);
  // TEST Checkout Pro deliberately returns the regular init_point only.
  return { id: provider.id, init_point: provider.init_point, testId, collectorId: String(provider.collector_id) };
}

/** One server-managed, deterministic Preview fixture for the temporary owner action. */
export async function createOneShotR7OwnerTestCheckoutPreference(
  dependencies: R7TestCheckoutDependencies = { env: process.env },
  db: Firestore = getAdminFirestore(),
  fixture: 'r1' | 'r5' | 'r5_webhook' = 'r1',
): Promise<{ id: string; init_point: string; testId: string; collectorId: string }> {
  const spec = fixture === 'r5_webhook'
    ? { receiptId: 'r7_test_owner_checkout_r5_webhook_v1', amount: 5 as const }
    : fixture === 'r5'
      ? { receiptId: OWNER_TEST_R5_RECEIPT_ID, amount: 5 as const }
      : { receiptId: OWNER_TEST_RECEIPT_ID, amount: 1 as const };
  const ref = db.collection('r7_test_checkout_receipts').doc(spec.receiptId);
  const state = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const existing = snapshot.data();
    if (existing?.state === 'created') return 'completed' as const;
    if (existing?.state === 'creating') return 'in_progress' as const;
    transaction.set(ref, {
      testMarker: 'R7_TEST', state: 'creating', source: 'temporary_owner_auth',
      testId: spec.receiptId, amount: spec.amount, currency: 'BRL', createdAt: new Date(), updatedAt: new Date(),
    }, { merge: true });
    return 'reserved' as const;
  });
  if (state === 'completed') throw new HttpError(404, 'NOT_FOUND', 'Not found');
  if (state === 'in_progress') throw new HttpError(409, 'R7_TEST_IN_PROGRESS', 'R7 test preference is in progress');

  try {
    const result = await createR7TestCheckoutPreference({ ...dependencies, testId: spec.receiptId, amount: spec.amount });
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
