import type { BookingSlot } from './booking-domain.js';

export const BOOKING_SLOTS = ['full_day', 'morning', 'afternoon'] as const satisfies readonly BookingSlot[];
