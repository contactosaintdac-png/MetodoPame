import type {
  OrderState,
  OutboxState,
  PaymentAttemptState,
  VerifiedPaymentState,
} from './payment-domain.js';

export type CheckoutCustomer =
  | { kind: 'authenticated'; clientUid: string }
  | { kind: 'guest'; guestIntentId: string };

export interface OrderRecord {
  schemaVersion: 1;
  version: number;
  customer: CheckoutCustomer;
  bookingIds: string[];
  state: OrderState;
  amount: { total: number; currency: 'BRL' };
  pricingVersion: string;
  payment: {
    state: VerifiedPaymentState | 'unverified';
    attemptId?: string;
    providerPaymentId?: string;
    approvedAt?: unknown;
  };
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PaymentAttemptRecord {
  schemaVersion: 1;
  version: number;
  orderId: string;
  provider: 'mercado_pago';
  state: PaymentAttemptState;
  externalReference: string;
  preferenceId?: string;
  providerPaymentId?: string;
  providerIdempotencyKey: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface PaymentEventRecord {
  schemaVersion: 1;
  provider: 'mercado_pago';
  providerPaymentId: string;
  providerUpdatedAt: string;
  providerStatus: string;
  providerStatusDetail?: string;
  normalizedState: VerifiedPaymentState;
  externalReference: string;
  amount: number;
  currency: string;
  liveMode: boolean;
  payloadHash: string;
  receiptId: string;
  processingState: 'pending' | 'applied' | 'ignored_stale' | 'needs_resolution' | 'error';
  createdAt: unknown;
  processedAt?: unknown;
}

export interface GuestPurchaseIntentRecord {
  schemaVersion: 1;
  version: number;
  tokenHash: string;
  bookingIds: string[];
  orderId?: string;
  state: 'active' | 'checkout_created' | 'paid' | 'expired' | 'revoked';
  expiresAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface OutboxJobRecord {
  schemaVersion: 1;
  state: OutboxState;
  kind:
    | 'calendar.booking_upsert'
    | 'email.booking_confirmed'
    | 'email.professional_assigned'
    | 'whatsapp.booking_event'
    | 'booking.reminder_schedule'
    | 'booking.address_reveal_schedule';
  bookingId: string;
  orderId: string;
  dedupeKey: string;
  payloadVersion: number;
  attempts: number;
  nextAttemptAt: unknown;
  leaseUntil?: unknown;
  lastErrorCode?: string;
  createdAt: unknown;
  updatedAt: unknown;
}
