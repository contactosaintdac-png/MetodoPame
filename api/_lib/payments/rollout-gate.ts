import { timingSafeEqual } from 'node:crypto';

import { effectiveBookingReadMode, readDataModelFlags, type DataModelFlags, type PaymentsMode } from '../data/feature-flags.js';
import { HttpError } from '../http-errors.js';

function values(raw: string | undefined): Set<string> {
  return new Set((raw ?? '').split(',').map((value) => value.trim()).filter(Boolean));
}

function safeEquals(left: string, right: string | undefined): boolean {
  if (!right || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function required(env: Record<string, string | undefined>, name: string, code: string): string {
  const value = env[name]?.trim();
  if (!value) throw new HttpError(503, code, `${name} is required for this rollout mode`);
  return value;
}

function requiredPositiveInteger(env: Record<string, string | undefined>, name: string, code: string): void {
  const value = Number(required(env, name, code));
  if (!Number.isInteger(value) || value < 1) throw new HttpError(503, code, `${name} must be a positive integer`);
}

function assertExpectedLiveMode(mode: PaymentsMode, env: Record<string, string | undefined>): void {
  const configured = required(env, 'MP_EXPECTED_LIVE_MODE', 'PAYMENT_ENVIRONMENT_NOT_CONFIGURED');
  if (configured !== 'true' && configured !== 'false') {
    throw new HttpError(503, 'PAYMENT_ENVIRONMENT_NOT_CONFIGURED', 'MP_EXPECTED_LIVE_MODE must be true or false');
  }
  if (mode === 'sandbox' && configured !== 'false') {
    throw new HttpError(503, 'PAYMENT_ENVIRONMENT_MISMATCH', 'Sandbox payments require MP_EXPECTED_LIVE_MODE=false');
  }
  if ((mode === 'canary' || mode === 'production') && configured !== 'true') {
    throw new HttpError(503, 'PAYMENT_ENVIRONMENT_MISMATCH', 'Canary and production payments require MP_EXPECTED_LIVE_MODE=true');
  }
}

function assertPaymentProviderConfiguration(mode: PaymentsMode, env: Record<string, string | undefined>): void {
  required(env, 'MP_ACCESS_TOKEN', 'PAYMENT_PROVIDER_UNAVAILABLE');
  required(env, 'MP_WEBHOOK_SECRET', 'WEBHOOK_AUTH_UNAVAILABLE');
  assertExpectedLiveMode(mode, env);
  if (mode === 'sandbox') {
    const isPreview = env.VERCEL_ENV === 'preview';
    const isIsolatedLocalTest = env.NODE_ENV === 'test' || Boolean(env.FIRESTORE_EMULATOR_HOST);
    if (!isPreview && !isIsolatedLocalTest) {
      throw new HttpError(503, 'PAYMENT_SANDBOX_PREVIEW_REQUIRED', 'Sandbox payments require an isolated Preview runtime');
    }
    required(env, 'MP_TEST_SELLER_ID', 'PAYMENT_TEST_SELLER_REQUIRED');
  }
}

function assertCanaryConfigured(env: Record<string, string | undefined>): void {
  if (values(env.PAYMENTS_CANARY_UIDS).size === 0 && !env.PAYMENTS_CANARY_CAPABILITY?.trim()) {
    throw new HttpError(503, 'PAYMENTS_CANARY_CONFIGURATION_REQUIRED', 'A canary UID or capability is required');
  }
}

/**
 * New checkout is intentionally stricter than a feature flag alone. A payment
 * cannot create canonical data unless the entire post-payment path is ready.
 */
export function assertCheckoutActivationConfiguration(
  env: Record<string, string | undefined> = process.env,
): { mode: Exclude<PaymentsMode, 'disabled' | 'drain_only'>; flags: DataModelFlags } {
  const flags = readDataModelFlags(env);
  const mode = flags.paymentsMode;
  if (!['sandbox', 'canary', 'production'].includes(mode)) {
    throw new HttpError(503, mode === 'drain_only' ? 'PAYMENTS_DRAIN_ONLY' : 'PAYMENTS_DISABLED', 'New checkout is unavailable');
  }
  const checkoutMode = mode as Exclude<PaymentsMode, 'disabled' | 'drain_only'>;
  if (flags.peopleReadMode !== 'canonical') throw new HttpError(503, 'PEOPLE_CANONICAL_READ_REQUIRED', 'Canonical People reads are required');
  if (flags.projectionReadMode !== 'on' || effectiveBookingReadMode(flags) !== 'canonical') {
    throw new HttpError(503, 'CANONICAL_BOOKING_READ_REQUIRED', 'Canonical booking projections are required');
  }
  if (flags.bookingWriteMode !== 'canonical') throw new HttpError(503, 'CANONICAL_BOOKING_WRITES_DISABLED', 'Canonical booking writes are disabled');
  if (flags.bookingHoldMode !== 'enforced') throw new HttpError(503, 'BOOKING_HOLDS_DISABLED', 'Booking holds are not enforced');
  if (flags.bookingEffectsMode !== 'payment_verified') throw new HttpError(503, 'BOOKING_EFFECTS_DISABLED', 'Booking effects are disabled');
  const expectedEffectsMode = mode === 'sandbox' ? 'sandbox' : 'production';
  if (flags.externalEffectsMode !== expectedEffectsMode) {
    throw new HttpError(503, 'EXTERNAL_EFFECTS_MODE_INCOMPATIBLE', 'External effects mode is incompatible with payments mode');
  }
  requiredPositiveInteger(env, 'BOOKING_HOLD_TTL_SECONDS', 'BOOKING_HOLD_TTL_REQUIRED');
  requiredPositiveInteger(env, 'GUEST_CHECKOUT_INTENT_TTL_SECONDS', 'GUEST_CHECKOUT_TTL_REQUIRED');
  required(env, 'GUEST_CHECKOUT_TOKEN_SECRET', 'GUEST_CHECKOUT_SECRET_REQUIRED');
  required(env, 'PUBLIC_APP_URL', 'CHECKOUT_CONFIG_UNAVAILABLE');
  assertPaymentProviderConfiguration(checkoutMode, env);
  if (checkoutMode === 'canary') assertCanaryConfigured(env);
  return { mode: checkoutMode, flags };
}

export function paymentModeAllowsNewCheckout(input: {
  uid?: string;
  capability?: string;
  env?: Record<string, string | undefined>;
}): { mode: PaymentsMode } {
  const env = input.env ?? process.env;
  const mode = readDataModelFlags(env).paymentsMode;
  if (mode === 'sandbox' || mode === 'production') return { mode };
  if (mode === 'canary') {
    const uidAllowed = input.uid ? values(env.PAYMENTS_CANARY_UIDS).has(input.uid) : false;
    const capabilityAllowed = safeEquals(String(input.capability ?? ''), env.PAYMENTS_CANARY_CAPABILITY);
    if (uidAllowed || capabilityAllowed) return { mode };
    throw new HttpError(503, 'PAYMENTS_CANARY_RESTRICTED', 'Checkout is not enabled for this actor');
  }
  throw new HttpError(503, mode === 'drain_only' ? 'PAYMENTS_DRAIN_ONLY' : 'PAYMENTS_DISABLED', 'New checkout is unavailable');
}

/** The browser-facing booking command endpoint is never a checkout authority. */
export function assertBrowserBookingMutationDisabled(): never {
  throw new HttpError(503, 'DIRECT_BOOKING_COMMAND_DISABLED', 'Booking mutations are available only through checkout orchestration');
}

export function assertWebhookProcessingEnabled(env: Record<string, string | undefined> = process.env): { mode: PaymentsMode } {
  const mode = readDataModelFlags(env).paymentsMode;
  if (!['sandbox', 'canary', 'production', 'drain_only'].includes(mode)) {
    throw new HttpError(503, 'PAYMENTS_DISABLED', 'Payment webhook processing is disabled');
  }
  assertPaymentProviderConfiguration(mode, env);
  return { mode };
}

/**
 * `APP_USR` identifies both real and TEST seller tokens.  The prefix alone is
 * never proof of a safe sandbox credential; Preview must identify the expected
 * test collector and the provider response must agree before we persist it.
 */
export function assertSandboxPreferenceCollector(
  collectorId: string | number | undefined,
  env: Record<string, string | undefined> = process.env,
): void {
  if (readDataModelFlags(env).paymentsMode !== 'sandbox') return;
  const expected = required(env, 'MP_TEST_SELLER_ID', 'PAYMENT_TEST_SELLER_REQUIRED');
  if (collectorId === undefined || String(collectorId) !== expected) {
    throw new HttpError(502, 'PAYMENT_TEST_SELLER_MISMATCH', 'Payment provider collector does not match the configured TEST seller');
  }
}

export function assertOutboxProcessingEnabled(env: Record<string, string | undefined> = process.env): void {
  const flags = readDataModelFlags(env);
  if (!['sandbox', 'canary', 'production', 'drain_only'].includes(flags.paymentsMode)) {
    throw new HttpError(503, 'PAYMENTS_DISABLED', 'Payment effects are disabled');
  }
  if (flags.bookingEffectsMode !== 'payment_verified') {
    throw new HttpError(503, 'BOOKING_EFFECTS_DISABLED', 'Booking external effects are disabled');
  }
  if (!['mock', 'sandbox', 'production'].includes(flags.externalEffectsMode)) {
    throw new HttpError(503, 'EXTERNAL_EFFECTS_DISABLED', 'External effects are disabled');
  }
}
