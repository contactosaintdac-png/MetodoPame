import type { ClientBookingView, FinanceBookingView, ProfessionalBookingView } from './data-contracts.js';

export interface CanonicalBookingProjectionSource {
  id: string;
  clientUid: string;
  date: string;
  shift?: string;
  service: string;
  status: string;
  amount?: number;
  currency?: string;
  paymentState?: string;
  providerReference?: string;
  assignedProfessionalUid?: string;
  assignmentState?: 'unassigned' | 'provisional' | 'assigned' | 'reassignment_required';
  assignedProfessionalName?: string;
  assignedProfessionalPhotoURL?: string;
  clientDisplayName?: string;
  operationalNotes?: string;
  address?: string;
  clientEmail?: string;
  clientPhone?: string;
  residenceAccessInstructions?: string;
}

export interface OperationsBookingView {
  bookingId: string;
  clientUid: string;
  professionalUid?: string;
  date: string;
  shift?: string;
  service: string;
  status: string;
  clientDisplayName: string;
}

export function projectClientBooking(source: CanonicalBookingProjectionSource): ClientBookingView {
  return {
    bookingId: source.id, clientUid: source.clientUid, date: source.date,
    ...(source.shift ? { shift: source.shift } : {}), service: source.service, status: source.status,
    ...(typeof source.amount === 'number' ? { totalPrice: source.amount } : {}),
    ...(source.assignmentState === 'assigned' && source.assignedProfessionalName ? { assignedProfessional: {
      name: source.assignedProfessionalName,
      ...(source.assignedProfessionalPhotoURL ? { photoURL: source.assignedProfessionalPhotoURL } : {}),
    } } : {}),
  };
}

export function projectProfessionalBooking(source: CanonicalBookingProjectionSource): ProfessionalBookingView | null {
  if (!source.assignedProfessionalUid || source.assignmentState !== 'assigned') return null;
  return {
    bookingId: source.id, professionalUid: source.assignedProfessionalUid, date: source.date,
    ...(source.shift ? { shift: source.shift } : {}), service: source.service, status: source.status,
    clientDisplayName: source.clientDisplayName || 'Cliente',
    ...(source.operationalNotes ? { operationalNotes: source.operationalNotes } : {}),
    addressAccessState: 'available_via_command',
  };
}

export function projectOperationsBooking(source: CanonicalBookingProjectionSource): OperationsBookingView {
  return {
    bookingId: source.id, clientUid: source.clientUid,
    ...(source.assignedProfessionalUid ? { professionalUid: source.assignedProfessionalUid } : {}),
    date: source.date, ...(source.shift ? { shift: source.shift } : {}),
    service: source.service, status: source.status, clientDisplayName: source.clientDisplayName || 'Cliente',
  };
}

export function projectFinanceBooking(source: CanonicalBookingProjectionSource): FinanceBookingView | null {
  if (typeof source.amount !== 'number') return null;
  return {
    bookingId: source.id, clientUid: source.clientUid, quotedAmount: source.amount, currency: 'BRL',
    paymentState: source.paymentState ?? 'unknown',
    ...(source.providerReference ? { providerReference: source.providerReference } : {}),
  };
}
