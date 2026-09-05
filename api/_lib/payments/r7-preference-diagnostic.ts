import { HttpError } from '../http-errors.js';
import { assertR7PreviewTestOwnerAccess } from './r7-preview-test-service.js';

const PREFERENCE_ID = '3648917580-0daf1f15-0de0-43bf-8d28-6b9285cd39a9';
const TEST_ID = 'r7_test_owner_checkout_r5_v1';
const APP_URL = 'https://metodo-pame-r7-test-contactosaintdac.vercel.app';
type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const identifier = (value: unknown) => typeof value === 'number' ? number(value) : typeof value === 'string' && /^\d{1,25}$/.test(value) ? value : null;
const code = (value: unknown) => typeof value === 'string' && /^[A-Za-z_]{0,60}$/.test(value) ? value : null;
const date = (value: unknown) => value === null || value === '' ? value : typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.+Z-]+$/.test(value) ? value : '[REDACTED]';
const expected = (value: unknown, allowed: string) => value === allowed || value === '' || value === null ? value : '[REDACTED_UNEXPECTED]';
const nonempty = (value: unknown): boolean => value != null && value !== '' && (typeof value !== 'object' || Object.values(value).some(nonempty));
const presence = (value: unknown) => Object.fromEntries(Object.entries(object(value)).filter(([key]) => ['id', 'name', 'surname', 'email', 'phone', 'identification', 'address', 'date_created', 'last_purchase', 'authentication_type', 'mode', 'cost', 'free_shipping', 'receiver_address', 'dimensions', 'default_shipping_method', 'local_pickup'].includes(key)).map(([key, entry]) => [key, nonempty(entry)]));
const exclusions = (value: unknown) => Array.isArray(value) ? value.map(entry => ({ id: code(object(entry).id) })) : null;

/** Explicit allowlist: never spread a provider object or return buyer values. */
export function sanitizeR7Preference(input: unknown): Json {
  const source = object(input);
  const result: Json = {};
  const put = (key: string, transform: (value: unknown) => unknown) => {
    if (Object.hasOwn(source, key)) result[key] = transform(source[key]);
  };
  put('id', value => expected(value, PREFERENCE_ID));
  for (const key of ['collector_id', 'client_id']) put(key, identifier);
  for (const key of ['live_mode', 'binary_mode', 'expires']) put(key, value => typeof value === 'boolean' ? value : null);
  for (const key of ['operation_type', 'purpose', 'auto_return', 'marketplace', 'status']) put(key, code);
  for (const key of ['marketplace_fee', 'installments']) put(key, number);
  for (const key of ['expiration_date_from', 'expiration_date_to', 'date_created']) put(key, date);
  put('items', value => Array.isArray(value) ? value.map(entry => {
    const item = object(entry);
    return { id: expected(item.id, TEST_ID), title: expected(item.title, 'R7 TEST — Método Pame'), quantity: number(item.quantity), unit_price: number(item.unit_price), currency_id: item.currency_id === 'BRL' ? 'BRL' : '[UNEXPECTED_CURRENCY]' };
  }) : null);
  put('payment_methods', value => {
    const methods = object(value); const safe: Json = {};
    for (const key of ['installments', 'default_installments']) if (Object.hasOwn(methods, key)) safe[key] = number(methods[key]);
    for (const key of ['default_payment_method_id']) if (Object.hasOwn(methods, key)) safe[key] = code(methods[key]);
    for (const key of ['excluded_payment_methods', 'excluded_payment_types']) if (Object.hasOwn(methods, key)) safe[key] = exclusions(methods[key]);
    return safe;
  });
  for (const key of ['excluded_payment_methods', 'excluded_payment_types']) put(key, exclusions);
  put('payer', value => ({ present: value != null, nonemptyFields: presence(value) }));
  put('shipments', value => ({ present: value != null, nonemptyFields: presence(value) }));
  put('back_urls', value => Object.fromEntries(['success', 'failure', 'pending'].filter(key => Object.hasOwn(object(value), key)).map(key => [key, expected(object(value)[key], APP_URL)])));
  put('notification_url', value => expected(value, `${APP_URL}/api/mercadopago-webhook`));
  put('external_reference', value => expected(value, TEST_ID));
  put('statement_descriptor', value => expected(value, 'METODO PAME'));
  put('differential_pricing', value => ({ present: value != null, id: identifier(object(value).id) }));
  put('metadata', value => {
    const metadata = object(value);
    return { r7_test: metadata.r7_test === true, test_id: expected(metadata.test_id, TEST_ID), amount_brl: number(metadata.amount_brl), schema_version: number(metadata.schema_version) };
  });
  for (const key of ['warnings', 'warning', 'restrictions', 'restriction']) put(key, value => ({ present: value != null, count: Array.isArray(value) ? value.length : value == null ? 0 : 1, codes: (Array.isArray(value) ? value : [value]).map(entry => code(object(entry).code) ?? code(entry)) }));
  result.init_point_present = typeof source.init_point === 'string' && source.init_point.length > 0;
  result.sandbox_init_point_present = typeof source.sandbox_init_point === 'string' && source.sandbox_init_point.length > 0;
  result.other_provider_field_names = Object.keys(source).filter(key => !Object.hasOwn(result, key) && !['init_point', 'sandbox_init_point'].includes(key) && /^[a-z_]{1,60}$/.test(key));
  return result;
}

export async function diagnoseR7Preference(
  req: { headers?: Record<string, string | string[] | undefined>; body?: unknown; query?: Record<string, unknown> },
  env: Record<string, string | undefined> = process.env,
  dependencies: { auth?: Parameters<typeof assertR7PreviewTestOwnerAccess>[2]; fetch?: typeof fetch } = {},
) {
  await assertR7PreviewTestOwnerAccess(req, env, dependencies.auth);
  if ((req.body != null && req.body !== '' && (typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length > 0)) || Object.keys(req.query ?? {}).some(key => key !== 'action')) {
    throw new HttpError(400, 'INVALID_REQUEST', 'Diagnostic accepts no input');
  }
  if (env.MP_TEST_SELLER_ID !== '3648917580' || env.MP_EXPECTED_LIVE_MODE !== 'false' || env.PAYMENTS_MODE !== 'disabled' || !env.MP_ACCESS_TOKEN) {
    throw new HttpError(503, 'R7_TEST_CONFIG_REQUIRED', 'R7 TEST configuration is unavailable');
  }
  let response: Response;
  try {
    response = await (dependencies.fetch ?? fetch)(`https://api.mercadopago.com/checkout/preferences/${PREFERENCE_ID}`, {
      method: 'GET', redirect: 'error', headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(10000),
    });
  } catch { return { providerHttpStatus: null, providerErrorCode: 'transport_error', message: 'Provider read could not complete' }; }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return { providerHttpStatus: response.status, providerErrorCode: code(object(body).error) ?? code(object(body).code) ?? 'provider_error', message: 'Mercado Pago rejected the read-only Preference query' };
  if (object(body).id !== PREFERENCE_ID) return { providerHttpStatus: response.status, providerErrorCode: 'unexpected_preference', message: 'Provider response did not match the allowed Preference' };
  return { providerHttpStatus: response.status, preference: sanitizeR7Preference(body) };
}
