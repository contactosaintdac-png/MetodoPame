import type { ClientBookingView } from '../../../shared/data-contracts.js';
import type { BookingReadMode } from './feature-flags.js';

export interface ClientBookingReadRepository {
  listForClient(uid: string): Promise<ClientBookingView[]>;
  getForClient(uid: string, bookingId: string): Promise<ClientBookingView | null>;
}

export interface ShadowDifference {
  uid: string;
  bookingId?: string;
  legacyFingerprint: string;
  canonicalFingerprint: string;
}

export interface BookingCorrespondence {
  bookingId: string;
  legacyBookingIds?: string[];
  source?: { legacyBookingIds?: string[]; references?: string[] };
}

export function bookingCorrespondenceKeys(item: BookingCorrespondence): string[] {
  const ids = new Set<string>([item.bookingId]);
  for (const id of item.legacyBookingIds ?? item.source?.legacyBookingIds ?? []) if (id) ids.add(id);
  for (const reference of item.source?.references ?? []) {
    const match = /\/bookings\/([^/]+)$/.exec(reference) ?? /reservas_index\/([^/]+)$/.exec(reference);
    if (match?.[1]) ids.add(match[1]);
  }
  return [...ids];
}

function normalized(value: unknown): string {
  return JSON.stringify(value, Object.keys((value && typeof value === 'object' ? value : {}) as object).sort());
}

export function mergeByBookingCorrespondence<T extends ClientBookingView & BookingCorrespondence>(legacy: T[], canonical: T[]): T[] {
  const merged = new Map<string, T>();
  for (const item of legacy) for (const key of bookingCorrespondenceKeys(item)) merged.set(key, item);
  for (const item of canonical) {
    for (const key of bookingCorrespondenceKeys(item)) merged.delete(key);
    for (const key of bookingCorrespondenceKeys(item)) merged.set(key, item);
  }
  const unique = new Map<string, T>(); for (const item of merged.values()) unique.set(item.bookingId, item);
  return [...unique.values()].sort((left, right) => right.date.localeCompare(left.date));
}

export function createModeAwareBookingRepository(input: {
  mode: BookingReadMode;
  legacy: ClientBookingReadRepository;
  canonical: ClientBookingReadRepository;
  onDifference?: (difference: ShadowDifference) => void | Promise<void>;
}): ClientBookingReadRepository {
  async function compare(uid: string, bookingId: string | undefined, legacy: unknown, canonical: unknown) {
    const legacyFingerprint = normalized(legacy); const canonicalFingerprint = normalized(canonical);
    if (legacyFingerprint !== canonicalFingerprint) await input.onDifference?.({ uid, ...(bookingId ? { bookingId } : {}), legacyFingerprint, canonicalFingerprint });
  }
  return {
    async listForClient(uid) {
      if (input.mode === 'canonical') return input.canonical.listForClient(uid);
      if (input.mode === 'dual') return mergeByBookingCorrespondence(await input.legacy.listForClient(uid), await input.canonical.listForClient(uid));
      const legacy = await input.legacy.listForClient(uid);
      if (input.mode === 'shadow') await compare(uid, undefined, legacy, await input.canonical.listForClient(uid));
      return legacy;
    },
    async getForClient(uid, bookingId) {
      if (input.mode === 'canonical') return input.canonical.getForClient(uid, bookingId);
      if (input.mode === 'dual') {
        const canonical = await input.canonical.listForClient(uid);
        const mapped = canonical.find((item) => bookingCorrespondenceKeys(item).includes(bookingId));
        return mapped ?? input.legacy.getForClient(uid, bookingId);
      }
      const legacy = await input.legacy.getForClient(uid, bookingId);
      if (input.mode === 'shadow') await compare(uid, bookingId, legacy, await input.canonical.getForClient(uid, bookingId));
      return legacy;
    },
  };
}
