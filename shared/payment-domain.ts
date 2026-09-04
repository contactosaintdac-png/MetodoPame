export const ORDER_STATES = [
  'created',
  'payment_pending',
  'paid',
  'paid_needs_resolution',
  'payment_failed',
  'cancelled',
  'refunded',
  'charged_back',
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export const PAYMENT_ATTEMPT_STATES = [
  'creating',
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'error',
  'unknown',
  'refunded',
  'charged_back',
] as const;

export type PaymentAttemptState = (typeof PAYMENT_ATTEMPT_STATES)[number];

export const VERIFIED_PAYMENT_STATES = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'refunded',
  'charged_back',
  'unknown',
] as const;

export type VerifiedPaymentState = (typeof VERIFIED_PAYMENT_STATES)[number];

export const OUTBOX_STATES = [
  'pending',
  'processing',
  'retryable',
  'succeeded',
  'dead_letter',
  'cancelled',
] as const;

export type OutboxState = (typeof OUTBOX_STATES)[number];

const ORDER_TRANSITIONS: Record<OrderState, readonly OrderState[]> = {
  created: ['payment_pending', 'paid_needs_resolution', 'payment_failed', 'cancelled'],
  payment_pending: ['paid', 'paid_needs_resolution', 'payment_failed', 'cancelled'],
  paid: ['refunded', 'charged_back'],
  paid_needs_resolution: ['paid', 'refunded', 'charged_back'],
  payment_failed: ['payment_pending', 'cancelled'],
  cancelled: [],
  refunded: [],
  charged_back: [],
};

const ATTEMPT_TRANSITIONS: Record<PaymentAttemptState, readonly PaymentAttemptState[]> = {
  creating: ['pending', 'error'],
  pending: ['approved', 'rejected', 'cancelled', 'error', 'unknown'],
  approved: ['refunded', 'charged_back'],
  rejected: [],
  cancelled: [],
  error: ['pending'],
  unknown: ['pending', 'approved', 'rejected', 'cancelled', 'refunded', 'charged_back'],
  refunded: [],
  charged_back: [],
};

export function canTransitionOrder(from: OrderState, to: OrderState): boolean {
  return from === to || ORDER_TRANSITIONS[from].includes(to);
}

export function canTransitionPaymentAttempt(
  from: PaymentAttemptState,
  to: PaymentAttemptState,
): boolean {
  return from === to || ATTEMPT_TRANSITIONS[from].includes(to);
}

export function normalizeMercadoPagoStatus(status: unknown): VerifiedPaymentState {
  if (status === 'approved') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'refunded') return 'refunded';
  if (status === 'charged_back') return 'charged_back';
  if (status === 'pending' || status === 'in_process' || status === 'authorized') return 'pending';
  return 'unknown';
}

export function orderStateForVerifiedPayment(state: VerifiedPaymentState): OrderState | null {
  if (state === 'approved') return 'paid';
  if (state === 'rejected') return 'payment_failed';
  if (state === 'cancelled') return 'cancelled';
  if (state === 'refunded') return 'refunded';
  if (state === 'charged_back') return 'charged_back';
  return null;
}
