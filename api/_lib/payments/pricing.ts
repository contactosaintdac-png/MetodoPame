import { HttpError } from '../http-errors.js';

export const CHECKOUT_ADDONS = [
  'dobra', 'passadoria', 'loucas', 'eletros', 'polimento', 'closets', 'vidros', 'despensa',
] as const;

export type CheckoutAddon = (typeof CHECKOUT_ADDONS)[number];

export interface PricingInput {
  format: 'meio' | 'completo';
  mode: 'avulso' | 'mensal';
  triage: {
    rooms: number;
    baths: number;
    floors: number;
    marble: boolean;
    wood: boolean;
    doubleGlass: boolean;
    chandeliers: boolean;
  };
  addons: CheckoutAddon[];
}

export interface ServerPriceQuote {
  total: number;
  currency: 'BRL';
  pricingVersion: 'checkout-brl-2026-08-v1';
}

export function resolveServerPrice(input: PricingInput): ServerPriceQuote {
  if (new Set(input.addons).size !== input.addons.length) {
    throw new HttpError(400, 'INVALID_PAYLOAD', 'activeAddons contains duplicates');
  }
  const sessions = input.mode === 'mensal' ? 4 : 1;
  const base = input.format === 'meio' ? 350 : 450;
  const size = Math.max(0, input.triage.rooms - 3) * 50
    + Math.max(0, input.triage.baths - 2) * 30
    + Math.max(0, input.triage.floors - 1) * 80;
  const surfaces = [
    input.triage.marble,
    input.triage.wood,
    input.triage.doubleGlass,
    input.triage.chandeliers,
  ].filter(Boolean).length * 30;
  const discount = input.mode === 'mensal' ? (input.format === 'meio' ? 200 : 300) : 0;
  const total = (base + size + surfaces + input.addons.length * 50) * sessions - discount;
  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new HttpError(500, 'PRICING_INVALID', 'Server pricing produced an invalid amount');
  }
  return { total, currency: 'BRL', pricingVersion: 'checkout-brl-2026-08-v1' };
}
