import type { Firestore } from 'firebase-admin/firestore';

import { buildAvailabilityProjection, type AvailabilityShift } from './availability-read-model.js';
import { createModeAwareBookingRepository, type ClientBookingReadRepository } from './data/booking-read-repository.js';
import { effectiveBookingReadMode, readDataModelFlags } from './data/feature-flags.js';
import { getAdminFirestore } from './firebase-admin.js';

export interface SafeBookingProjection {
  id: string;
  date: string;
  time: string;
  status: string;
  service: string;
  assignedProfessionalName?: string;
}

export interface ConciergeReadModel {
  listOwnBookings(uid: string): Promise<SafeBookingProjection[]>;
  getOwnBooking(uid: string, bookingId: string): Promise<SafeBookingProjection | null>;
  getAvailability(date: string, shift: AvailabilityShift): Promise<boolean>;
}

function projectBooking(id: string, data: Record<string, unknown>): SafeBookingProjection {
  return {
    id,
    date: typeof data.date === 'string' ? data.date : '',
    time: typeof data.time === 'string' ? data.time : '',
    status: typeof data.status === 'string' ? data.status : 'Pendente',
    service: typeof data.service === 'string'
      ? data.service
      : typeof data.format === 'string'
        ? data.format
        : 'Serviço residencial',
    ...(typeof data.assignedEmployeeName === 'string'
      ? { assignedProfessionalName: data.assignedEmployeeName }
      : {}),
  };
}

function repositories(database: Firestore): { legacy: ClientBookingReadRepository; canonical: ClientBookingReadRepository } {
  return {
    legacy: {
      async listForClient(uid) {
        const snapshot = await database.collection('users').doc(uid).collection('bookings').limit(20).get();
        return snapshot.docs.map((document) => ({ bookingId: document.id, clientUid: uid, date: String(document.get('date') ?? ''), shift: String(document.get('time') ?? document.get('shift') ?? ''), service: String(document.get('service') ?? document.get('format') ?? 'Serviço residencial'), status: String(document.get('status') ?? 'Pendente') }));
      },
      async getForClient(uid, bookingId) {
        const snapshot = await database.collection('users').doc(uid).collection('bookings').doc(bookingId).get();
        return snapshot.exists ? { bookingId, clientUid: uid, date: String(snapshot.get('date') ?? ''), shift: String(snapshot.get('time') ?? snapshot.get('shift') ?? ''), service: String(snapshot.get('service') ?? snapshot.get('format') ?? 'Serviço residencial'), status: String(snapshot.get('status') ?? 'Pendente') } : null;
      },
    },
    canonical: {
      async listForClient(uid) {
        const snapshot = await database.collection('client_booking_views').doc(uid).collection('items').limit(20).get();
        return snapshot.docs.map((document) => document.data() as never);
      },
      async getForClient(uid, bookingId) {
        const snapshot = await database.collection('client_booking_views').doc(uid).collection('items').doc(bookingId).get();
        return snapshot.exists ? snapshot.data() as never : null;
      },
    },
  };
}

function projectSafe(item: Awaited<ReturnType<ClientBookingReadRepository['getForClient']>> & {}): SafeBookingProjection {
  return {
    id: item.bookingId, date: item.date, time: item.shift ?? '', status: item.status,
    service: item.service,
    ...(item.assignedProfessional?.name ? { assignedProfessionalName: item.assignedProfessional.name } : {}),
  };
}

export function createConciergeReadModel(
  db?: Firestore,
): ConciergeReadModel {
  return {
    async listOwnBookings(uid) {
      const database = db ?? getAdminFirestore();
      const source = repositories(database);
      const repository = createModeAwareBookingRepository({ mode: effectiveBookingReadMode(readDataModelFlags()), ...source });
      return (await repository.listForClient(uid)).map(projectSafe);
    },
    async getOwnBooking(uid, bookingId) {
      const database = db ?? getAdminFirestore();
      const source = repositories(database);
      const repository = createModeAwareBookingRepository({ mode: effectiveBookingReadMode(readDataModelFlags()), ...source });
      const booking = await repository.getForClient(uid, bookingId);
      return booking ? projectSafe(booking) : null;
    },
    async getAvailability(date, shift) {
      const projection = await buildAvailabilityProjection(date, date, db ?? getAdminFirestore());
      return projection[date]?.[shift] ?? false;
    },
  };
}
