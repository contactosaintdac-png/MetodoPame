export type PeopleReadMode = 'legacy' | 'dual' | 'canonical';
export type BookingReadMode = 'legacy' | 'shadow' | 'dual' | 'canonical';
export type ProjectionReadMode = 'off' | 'shadow' | 'on';
export type BookingWriteMode = 'disabled' | 'canonical_with_legacy_mirror' | 'canonical';
export type BookingHoldMode = 'off' | 'shadow' | 'enforced';
export type BookingEffectsMode = 'disabled' | 'payment_verified';
export type PaymentsMode = 'disabled' | 'sandbox' | 'canary' | 'production' | 'drain_only';
export type ExternalEffectsMode = 'disabled' | 'mock' | 'sandbox' | 'production' | 'drain_only';

function oneOf<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

export interface DataModelFlags {
  peopleReadMode: PeopleReadMode;
  bookingReadMode: BookingReadMode;
  projectionReadMode: ProjectionReadMode;
  bookingWriteMode: BookingWriteMode;
  bookingHoldMode: BookingHoldMode;
  bookingEffectsMode: BookingEffectsMode;
  paymentsMode: PaymentsMode;
  externalEffectsMode: ExternalEffectsMode;
}

export function readDataModelFlags(env: Record<string, string | undefined> = process.env): DataModelFlags {
  return {
    peopleReadMode: oneOf(env.PEOPLE_READ_MODE, ['legacy', 'dual', 'canonical'], 'legacy'),
    bookingReadMode: oneOf(env.BOOKING_READ_MODE, ['legacy', 'shadow', 'dual', 'canonical'], 'legacy'),
    projectionReadMode: oneOf(env.PROJECTION_READ_MODE, ['off', 'shadow', 'on'], 'off'),
    bookingWriteMode: oneOf(env.BOOKING_WRITE_MODE, ['disabled', 'canonical_with_legacy_mirror', 'canonical'], 'disabled'),
    bookingHoldMode: oneOf(env.BOOKING_HOLD_MODE, ['off', 'shadow', 'enforced'], 'off'),
    bookingEffectsMode: oneOf(env.BOOKING_EFFECTS_MODE, ['disabled', 'payment_verified'], 'disabled'),
    paymentsMode: oneOf(env.PAYMENTS_MODE, ['disabled', 'sandbox', 'canary', 'production', 'drain_only'], 'disabled'),
    externalEffectsMode: oneOf(env.EXTERNAL_EFFECTS_MODE, ['disabled', 'mock', 'sandbox', 'production', 'drain_only'], 'disabled'),
  };
}

/** Projections cannot become an authority by toggling a booking read flag alone. */
export function effectiveBookingReadMode(flags: DataModelFlags): BookingReadMode {
  if (flags.projectionReadMode === 'off') return 'legacy';
  if (flags.projectionReadMode === 'shadow' && flags.bookingReadMode === 'canonical') return 'shadow';
  return flags.bookingReadMode;
}
