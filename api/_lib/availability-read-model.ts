import type { Firestore } from 'firebase-admin/firestore';

import { getAdminFirestore } from './firebase-admin.js';
import { HttpError } from './http-errors.js';
import { requireIsoDate } from './request-validation.js';

export const AVAILABILITY_SHIFTS = ['completo', 'meio_manha', 'meio_tarde'] as const;
export type AvailabilityShift = (typeof AVAILABILITY_SHIFTS)[number];
export type AvailabilityProjection = Record<string, Record<AvailabilityShift, boolean>>;

function enumerateDates(from: string, to: string): string[] {
  const first = new Date(`${from}T00:00:00.000Z`);
  const last = new Date(`${to}T00:00:00.000Z`);
  const days = Math.floor((last.getTime() - first.getTime()) / 86_400_000) + 1;
  if (days < 1 || days > 62) {
    throw new HttpError(400, 'INVALID_DATE_RANGE', 'Date range must contain 1 to 62 days');
  }
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(first);
    date.setUTCDate(first.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

function scheduleSupports(value: unknown, shift: AvailabilityShift): boolean {
  if (!Array.isArray(value)) return false;
  return shift === 'completo'
    ? value.includes('completo')
    : value.includes(shift) || value.includes('completo');
}

function isBlocked(blocked: readonly unknown[], shift: AvailabilityShift): boolean {
  return shift === 'completo'
    ? ['completo', 'meio_manha', 'meio_tarde'].some((item) => blocked.includes(item))
    : blocked.includes(shift) || blocked.includes('completo');
}

export async function buildAvailabilityProjection(
  fromValue: unknown,
  toValue: unknown,
  db: Firestore = getAdminFirestore(),
): Promise<AvailabilityProjection> {
  const from = requireIsoDate(fromValue, 'from');
  const to = requireIsoDate(toValue, 'to');
  const dates = enumerateDates(from, to);
  const projection: AvailabilityProjection = {};
  for (const date of dates) {
    projection[date] = { completo: false, meio_manha: false, meio_tarde: false };
  }

  const lockSnapshot = await db.collection('capacity_slot_locks')
    .where('localDate', '>=', from)
    .where('localDate', '<=', to)
    .get();
  const now = new Date();
  const locked = new Set(lockSnapshot.docs.flatMap((document) => {
    const data = document.data();
    const active = data.kind === 'booking'
      || (data.kind === 'hold' && data.expiresAt?.toDate?.().getTime() > now.getTime());
    return active ? [`${data.professionalUid}:${data.localDate}:${data.segment}`] : [];
  }));

  // Capacity is a server-maintained projection of the independent lifecycle
  // dimensions. Legacy employees never create capacity or eligibility.
  const professionals = await db.collection('professional_capacity')
    .where('eligibleForService', '==', true).get();
  for (const professionalDocument of professionals.docs) {
    const professional = professionalDocument.data();
    const weekly = professional.weeklyAvailability ?? {};
    const blockSnapshot = await db
      .collection('professional_capacity')
      .doc(professionalDocument.id)
      .collection('blocks')
      .get();
    const blocks = new Map(
      blockSnapshot.docs.map((document) => [
        document.id,
        Array.isArray(document.get('shifts')) ? document.get('shifts') : [],
      ]),
    );

    for (const date of dates) {
      const day = new Date(`${date}T12:00:00.000Z`).getUTCDay();
      const schedule = weekly[String(day)] ?? weekly[day] ?? [];
      const blocked = blocks.get(date) ?? [];
      for (const shift of AVAILABILITY_SHIFTS) {
        const segments = shift === 'completo' ? ['morning', 'afternoon'] : [shift === 'meio_manha' ? 'morning' : 'afternoon'];
        const hasCapacityLock = segments.some((segment) => locked.has(`${professionalDocument.id}:${date}:${segment}`));
        if (scheduleSupports(schedule, shift) && !isBlocked(blocked, shift) && !hasCapacityLock) {
          projection[date][shift] = true;
        }
      }
    }
  }
  return projection;
}
