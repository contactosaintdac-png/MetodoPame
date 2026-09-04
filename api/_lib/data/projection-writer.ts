import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { projectClientBooking, projectFinanceBooking, projectOperationsBooking, projectProfessionalBooking, type CanonicalBookingProjectionSource } from '../../../shared/projections.js';

export async function rebuildBookingProjections(db: Firestore, source: CanonicalBookingProjectionSource): Promise<void> {
  await db.runTransaction(async (tx) => writeBookingProjections(tx, db, source));
}

export function writeBookingProjections(
  tx: Transaction,
  db: Firestore,
  source: CanonicalBookingProjectionSource,
  previousProfessionalUid?: string,
): void {
  tx.set(db.collection('client_booking_views').doc(source.clientUid).collection('items').doc(source.id), projectClientBooking(source));
  tx.set(db.collection('operations_booking_views').doc(source.id), projectOperationsBooking(source));
  if (previousProfessionalUid && previousProfessionalUid !== source.assignedProfessionalUid) {
    tx.delete(db.collection('professional_booking_views').doc(previousProfessionalUid).collection('items').doc(source.id));
  }
  const professional = projectProfessionalBooking(source);
  if (professional) tx.set(db.collection('professional_booking_views').doc(professional.professionalUid).collection('items').doc(source.id), professional);
  else if (source.assignedProfessionalUid) tx.delete(db.collection('professional_booking_views').doc(source.assignedProfessionalUid).collection('items').doc(source.id));
  const finance = projectFinanceBooking(source);
  if (finance) tx.set(db.collection('finance_booking_views').doc(source.id), finance);
}
