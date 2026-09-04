import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { CanonicalBookingProjectionSource } from '../../../shared/projections.js';
import { readDataModelFlags } from '../data/feature-flags.js';

export function mirrorCanonicalBookingToLegacy(
  tx: Transaction,
  db: Firestore,
  source: CanonicalBookingProjectionSource,
): void {
  if (readDataModelFlags().bookingWriteMode !== 'canonical_with_legacy_mirror') return;
  const status = source.status === 'cancelled' ? 'Cancelado'
    : source.status === 'completed' ? 'Concluído'
      : source.status === 'confirmed' || source.status === 'in_progress' ? 'Confirmado' : 'Pendente';
  const payload = {
    canonicalBookingId: source.id, userId: source.clientUid, date: source.date,
    shift: source.shift ?? null, service: source.service, status,
    totalPrice: source.amount ?? null,
    assignedEmployeeId: source.assignmentState === 'assigned' ? source.assignedProfessionalUid ?? null : null,
    mirrorDirection: 'canonical_to_legacy', updatedAt: new Date(),
  };
  tx.set(db.collection('users').doc(source.clientUid).collection('bookings').doc(source.id), payload, { merge: true });
  tx.set(db.collection('reservas_index').doc(source.id), payload, { merge: true });
}
