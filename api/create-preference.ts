import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MercadoPagoConfig, Preference } from 'mercadopago';

import type { BookingSlot } from '../shared/booking-domain.js';
import { authorize } from './_lib/authorize.js';
import { authenticate, type AuthenticatedIdentity } from './_lib/authenticate.js';
import { getAdminFirestore } from './_lib/firebase-admin.js';
import { HttpError, toHttpError } from './_lib/http-errors.js';
import { applyPublicCors } from './_lib/http-policy.js';
import { attachPreference, prepareCheckout, type CheckoutIntentInput, type PreparedCheckout } from './_lib/payments/checkout-service.js';
import { CHECKOUT_ADDONS, type CheckoutAddon } from './_lib/payments/pricing.js';
import { enforcePublicRateLimit } from './_lib/rate-limit.js';
import { assertCheckoutActivationConfiguration, assertSandboxPreferenceCollector, paymentModeAllowsNewCheckout } from './_lib/payments/rollout-gate.js';
import {
  optionalString, rejectUnknownKeys, requireBoolean, requireEmail, requireEnum,
  requireIdempotencyKey, requireInteger, requireIsoDate, requireObject, requireString,
} from './_lib/request-validation.js';

interface PreferenceResult { id?: string; init_point?: string; collector_id?: number }

export interface PreferenceDependencies {
  enforceRateLimit(req: VercelRequest): Promise<void>;
  resolveIdentity(req: VercelRequest): Promise<AuthenticatedIdentity | undefined>;
  prepare(input: CheckoutIntentInput): Promise<PreparedCheckout>;
  loadExisting(attemptId: string): Promise<PreparedCheckout['preference'] | undefined>;
  createProviderPreference(input: PreparedCheckout & { appUrl: string }): Promise<PreferenceResult>;
  attach(input: { orderId: string; attemptId: string; preference: { id: string; initPoint: string } }): Promise<void>;
  assertCheckoutAllowed?(input: { uid?: string; capability?: string }): void;
  /** Injectable only for isolated handler tests; production uses the fail-closed gate. */
  assertCheckoutConfiguration?(): void;
}

function appUrl(): string {
  const configured = process.env.PUBLIC_APP_URL?.replace(/\/$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:3000';
  throw new HttpError(503, 'CHECKOUT_CONFIG_UNAVAILABLE', 'Checkout configuration is unavailable');
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function resolveIdentity(req: VercelRequest): Promise<AuthenticatedIdentity | undefined> {
  if (!headerValue(req.headers.authorization)) return undefined;
  const identity = await authenticate(req);
  await authorize(identity, 'bookings.request_own');
  return identity;
}

const defaultDependencies: PreferenceDependencies = {
  enforceRateLimit: (req) => enforcePublicRateLimit(req, 'checkout-preference', { limit: 10, windowMs: 60_000 }),
  resolveIdentity,
  prepare: (input) => prepareCheckout(input),
  async loadExisting(attemptId) {
    const attempt = await getAdminFirestore().collection('payment_attempts').doc(attemptId).get();
    if (!attempt.exists || !attempt.get('preferenceId') || !attempt.get('initPoint')) return undefined;
    return {
      id: String(attempt.get('preferenceId')),
      initPoint: String(attempt.get('initPoint')),
    };
  },
  async createProviderPreference(input) {
    const accessToken = process.env.MP_ACCESS_TOKEN;
    if (!accessToken) throw new HttpError(503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'Payment provider is unavailable');
    const preference = new Preference(new MercadoPagoConfig({ accessToken, options: { timeout: 5_000 } }));
    return preference.create({
      body: {
        items: [{ id: input.orderId, title: 'Curadoria residencial Método Pame', unit_price: input.amount, quantity: 1, currency_id: input.currency }],
        payer: { name: input.payerName, ...(input.payerEmail ? { email: input.payerEmail } : {}) },
        back_urls: { success: input.appUrl, failure: input.appUrl, pending: input.appUrl },
        notification_url: `${input.appUrl}/api/mercadopago-webhook`,
        auto_return: 'approved',
        payment_methods: { excluded_payment_types: [{ id: 'ticket' }], installments: 6 },
        statement_descriptor: 'METODO PAME',
        external_reference: input.externalReference,
        metadata: { order_id: input.orderId, attempt_id: input.attemptId, schema_version: 1 },
      },
      requestOptions: { idempotencyKey: input.providerIdempotencyKey },
    });
  },
  attach: (input) => attachPreference(input),
  assertCheckoutAllowed: (input) => { paymentModeAllowsNewCheckout(input); },
  assertCheckoutConfiguration: () => { assertCheckoutActivationConfiguration(); },
};

export function createPreferenceHandler(dependencies: PreferenceDependencies = defaultDependencies) {
  return async function preferenceHandler(req: VercelRequest, res: VercelResponse) {
    try {
      applyPublicCors(req, res, ['POST']);
      if (req.method === 'OPTIONS') return res.status(204).end();
      if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
      await dependencies.enforceRateLimit(req);
      const body = requireObject(req.body);
      rejectUnknownKeys(body, ['format', 'mode', 'triageData', 'activeAddons', 'clientName', 'clientEmail', 'clientPhone', 'address', 'localDate', 'slot']);
      const format = requireEnum(body.format, 'format', ['meio', 'completo'] as const);
      const mode = requireEnum(body.mode, 'mode', ['avulso', 'mensal'] as const);
      const triageData = requireObject(body.triageData, 'triageData');
      rejectUnknownKeys(triageData, ['rooms', 'baths', 'floors', 'marble', 'wood', 'doubleGlass', 'chandeliers']);
      if (!Array.isArray(body.activeAddons) || body.activeAddons.length > CHECKOUT_ADDONS.length) throw new HttpError(400, 'INVALID_PAYLOAD', 'activeAddons is invalid');
      const addons = body.activeAddons.map((addon) => requireEnum(addon, 'activeAddons', CHECKOUT_ADDONS)) as CheckoutAddon[];
      const slot = requireEnum(body.slot, 'slot', ['full_day', 'morning', 'afternoon'] as const) as BookingSlot;
      if ((format === 'completo' && slot !== 'full_day') || (format === 'meio' && slot === 'full_day')) throw new HttpError(400, 'INVALID_PAYLOAD', 'slot does not match format');
      const identity = await dependencies.resolveIdentity(req);
      (dependencies.assertCheckoutAllowed ?? ((input) => { paymentModeAllowsNewCheckout(input); }))({ uid: identity?.uid, capability: headerValue(req.headers['x-checkout-canary-capability']) });
      (dependencies.assertCheckoutConfiguration ?? (() => { assertCheckoutActivationConfiguration(); }))();
      const suppliedEmail = optionalString(body.clientEmail, 'clientEmail', { max: 254 });
      const clientEmail = identity?.email ?? (suppliedEmail ? requireEmail(suppliedEmail, 'clientEmail') : undefined);
      const idempotencyKey = requireIdempotencyKey(headerValue(req.headers['idempotency-key']));
      const prepared = await dependencies.prepare({
        format, mode,
        triage: {
          rooms: requireInteger(triageData.rooms, 'rooms', 1, 20), baths: requireInteger(triageData.baths, 'baths', 1, 20),
          floors: requireInteger(triageData.floors, 'floors', 1, 10), marble: requireBoolean(triageData.marble, 'marble'),
          wood: requireBoolean(triageData.wood, 'wood'), doubleGlass: requireBoolean(triageData.doubleGlass, 'doubleGlass'),
          chandeliers: requireBoolean(triageData.chandeliers, 'chandeliers'),
        },
        addons, localDate: requireIsoDate(body.localDate, 'localDate'), slot,
        clientName: requireString(body.clientName, 'clientName', { max: 120 }), ...(clientEmail ? { clientEmail } : {}),
        clientPhone: requireString(body.clientPhone, 'clientPhone', { max: 32 }), address: requireString(body.address, 'address', { max: 500 }),
        idempotencyKey, requestId: headerValue(req.headers['x-request-id']) ?? idempotencyKey, ...(identity ? { identity } : {}),
      });
      let saved = await dependencies.loadExisting(prepared.attemptId);
      if (!saved) {
        const provider = await dependencies.createProviderPreference({ ...prepared, appUrl: appUrl() });
        if (!provider.id || !provider.init_point) throw new HttpError(502, 'PAYMENT_PROVIDER_ERROR', 'Payment provider returned an invalid preference');
        // Checkout Pro TEST uses the normal init_point.  sandbox_init_point is
        // intentionally not persisted or returned, so callers cannot select it.
        assertSandboxPreferenceCollector(provider.collector_id);
        saved = { id: provider.id, initPoint: provider.init_point };
        await dependencies.attach({ orderId: prepared.orderId, attemptId: prepared.attemptId, preference: saved });
      }
      return res.status(200).json({
        id: saved.id, init_point: saved.initPoint,
        orderId: prepared.orderId, bookingIds: prepared.bookingIds,
        ...(prepared.guestAccessToken ? { guestAccessToken: prepared.guestAccessToken } : {}),
        bookingCreated: true, paymentConfirmed: false,
      });
    } catch (error) {
      const httpError = toHttpError(error);
      return res.status(httpError.status).json({ error: httpError.code, message: httpError.message });
    }
  };
}

export default createPreferenceHandler();
