export const BOOKING_STATES = [
  'pending_confirmation',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'expired',
] as const;

export type BookingState = (typeof BOOKING_STATES)[number];

export const BOOKING_REQUEST_STATES = ['submitted', 'held', 'converted', 'withdrawn'] as const;
export type BookingRequestState = (typeof BOOKING_REQUEST_STATES)[number];

export const BOOKING_HOLD_STATES = ['active', 'consumed', 'released', 'expired'] as const;
export type BookingHoldState = (typeof BOOKING_HOLD_STATES)[number];

export type BookingActorKind = 'client' | 'professional' | 'operations' | 'system' | 'ai';
export type PaymentState = 'unverified' | 'pending' | 'approved' | 'rejected' | 'refunded' | 'unknown';
export type AssignmentState = 'unassigned' | 'provisional' | 'assigned' | 'reassignment_required';
export type BookingSlot = 'full_day' | 'morning' | 'afternoon';

export interface BookingTransitionContext {
  actor: BookingActorKind;
  paymentApproved: boolean;
  hasActiveHold: boolean;
  hasAssignedProfessional: boolean;
}

const REQUEST_TRANSITIONS: Record<BookingRequestState, readonly BookingRequestState[]> = {
  submitted: ['held', 'withdrawn'],
  held: ['submitted', 'converted', 'withdrawn'],
  converted: [],
  withdrawn: [],
};

const HOLD_TRANSITIONS: Record<BookingHoldState, readonly BookingHoldState[]> = {
  active: ['consumed', 'released', 'expired'],
  consumed: [],
  released: [],
  expired: [],
};

export function canTransitionBookingRequest(from: BookingRequestState, to: BookingRequestState): boolean {
  return REQUEST_TRANSITIONS[from].includes(to);
}

export function canTransitionBookingHold(from: BookingHoldState, to: BookingHoldState): boolean {
  return HOLD_TRANSITIONS[from].includes(to);
}

export function bookingTransitionError(
  from: BookingState,
  to: BookingState,
  context: BookingTransitionContext,
): string | null {
  if (context.actor === 'ai') return 'AI_BOOKING_MUTATION_FORBIDDEN';
  if (from === to) return 'BOOKING_STATE_UNCHANGED';
  if (['completed', 'cancelled', 'expired'].includes(from)) return 'BOOKING_TERMINAL_STATE';

  if (from === 'pending_confirmation' && to === 'confirmed') {
    if (context.actor !== 'system') return 'PAYMENT_CONFIRMATION_REQUIRES_SYSTEM';
    if (!context.paymentApproved) return 'PAYMENT_EVIDENCE_REQUIRED';
    if (!context.hasActiveHold) return 'ACTIVE_HOLD_REQUIRED';
    return null;
  }
  if (from === 'pending_confirmation' && to === 'cancelled') {
    return context.actor === 'client' || context.actor === 'operations' ? null : 'ACTOR_NOT_ALLOWED';
  }
  if (from === 'pending_confirmation' && to === 'expired') {
    return context.actor === 'system' || context.actor === 'operations' ? null : 'ACTOR_NOT_ALLOWED';
  }
  if (from === 'confirmed' && to === 'in_progress') {
    if (context.actor !== 'professional' && context.actor !== 'operations') return 'ACTOR_NOT_ALLOWED';
    if (!context.paymentApproved) return 'PAYMENT_EVIDENCE_REQUIRED';
    if (!context.hasAssignedProfessional) return 'ASSIGNMENT_REQUIRED';
    return null;
  }
  if (from === 'confirmed' && to === 'cancelled') {
    return context.actor === 'operations' ? null : 'OPERATIONS_REQUIRED';
  }
  if (from === 'in_progress' && to === 'completed') {
    if (context.actor !== 'professional' && context.actor !== 'operations') return 'ACTOR_NOT_ALLOWED';
    if (!context.hasAssignedProfessional) return 'ASSIGNMENT_REQUIRED';
    return null;
  }
  return 'BOOKING_TRANSITION_FORBIDDEN';
}

export function slotSegments(slot: BookingSlot): readonly ('morning' | 'afternoon')[] {
  return slot === 'full_day' ? ['morning', 'afternoon'] : [slot];
}

export function isLogicalHoldActive(
  hold: { state: BookingHoldState; expiresAt: Date | { toDate(): Date } },
  now: Date,
): boolean {
  const expiresAt = hold.expiresAt instanceof Date ? hold.expiresAt : hold.expiresAt.toDate();
  return hold.state === 'active' && expiresAt.getTime() > now.getTime();
}
