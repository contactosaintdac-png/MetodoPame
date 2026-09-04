import type {
  AssignmentState,
  BookingHoldState,
  BookingRequestState,
  BookingSlot,
  BookingState,
  PaymentState,
} from './booking-domain.js';

export interface AuditStamp {
  actorUid: string;
  actorKind: 'client' | 'professional' | 'operations' | 'system';
  requestId: string;
  idempotencyKey: string;
}

export interface BookingRequestRecord {
  schemaVersion: 1;
  version: number;
  clientUid: string;
  residenceId: string;
  state: BookingRequestState;
  requestedSchedule: { timezone: 'America/Sao_Paulo'; localDate: string; slot: BookingSlot };
  requestedService: { catalogItemId: string; format: 'half_day' | 'full_day'; addonCodes: string[] };
  holdId?: string;
  bookingId?: string;
  source: { kind: 'native' | 'legacy_migration'; references: string[] };
  createdAt: unknown;
  updatedAt: unknown;
}

export interface BookingHoldRecord {
  schemaVersion: 1;
  version: number;
  requestId: string;
  clientUid: string;
  professionalUid: string;
  localDate: string;
  slot: BookingSlot;
  segments: ('morning' | 'afternoon')[];
  state: BookingHoldState;
  expiresAt: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface CapacitySlotLockRecord {
  schemaVersion: 1;
  professionalUid: string;
  localDate: string;
  segment: 'morning' | 'afternoon';
  kind: 'hold' | 'booking';
  ownerId: string;
  expiresAt?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ServiceBookingRecord {
  schemaVersion: 1;
  version: number;
  clientUid: string;
  residenceId: string;
  requestId: string;
  seriesId?: string;
  state: BookingState;
  schedule: {
    timezone: 'America/Sao_Paulo';
    localDate: string;
    slot: BookingSlot;
    revision: number;
  };
  service: { catalogItemId: string; format: 'half_day' | 'full_day'; addonCodes: string[] };
  commercialSnapshot: { quotedAmount: number; currency: 'BRL'; pricingVersion: string };
  payment: { state: PaymentState; orderId?: string };
  assignment: { state: AssignmentState; professionalUid?: string; revision: number };
  holdId?: string;
  source: { kind: 'native' | 'legacy_migration'; references: string[] };
  createdAt: unknown;
  updatedAt: unknown;
}

export interface BookingSeriesRecord {
  schemaVersion: 1;
  version: number;
  clientUid: string;
  residenceId: string;
  bookingIds: string[];
  cadence: { kind: 'explicit_dates'; localDates: string[] };
  state: 'active' | 'cancelled' | 'completed';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface BookingCommandEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  action: string;
  idempotencyKey: string;
  expectedVersion?: number;
  payload: TPayload;
}
