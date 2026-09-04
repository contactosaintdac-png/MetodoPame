export type SourceClassification = 'mappable' | 'ambiguous' | 'invalid' | 'orphan';

export interface SourceReference {
  collection: string;
  documentId: string;
  path: string;
  fingerprint: string;
}

export interface ReconciliationIssue {
  deterministicId: string;
  source: SourceReference;
  classification: Exclude<SourceClassification, 'mappable'>;
  reasonCodes: string[];
  requiresHumanReview: true;
}

export interface InventoryEntry {
  source: SourceReference;
  classification: SourceClassification;
  reasonCodes: string[];
  destinationKind?:
    | 'candidate_application'
    | 'professional'
    | 'client_profile'
    | 'legacy_booking_only';
}

export interface InventoryManifest {
  schemaVersion: 1;
  dryRun: true;
  entries: InventoryEntry[];
  counts: Record<SourceClassification, number>;
}

export interface CandidatePrivateRecord {
  applicationId: string;
  candidateUid: string;
  email?: string;
  whatsapp?: string;
  cpf?: string;
  birthDate?: string;
  references?: string;
}

export interface CandidateVerificationRecord {
  applicationId: string;
  documentsState: 'not_started' | 'needs_review' | 'verified';
  backgroundCheckState: 'not_started' | 'needs_review' | 'verified';
  reviewedBy?: string;
}

export interface ProfessionalPrivateRecord {
  professionalUid: string;
  email?: string;
  whatsapp?: string;
  cpf?: string;
}

export interface ClientPrivateRecord {
  clientUid: string;
  email?: string;
  phone?: string;
  name?: string;
}

export interface ClientBookingView {
  bookingId: string;
  clientUid: string;
  date: string;
  shift?: string;
  service: string;
  status: string;
  totalPrice?: number;
  assignedProfessional?: { name: string; photoURL?: string };
}

export interface ProfessionalBookingView {
  bookingId: string;
  professionalUid: string;
  date: string;
  shift?: string;
  service: string;
  status: string;
  clientDisplayName: string;
  operationalNotes?: string;
  addressAccessState: 'hidden' | 'available_via_command';
}

export interface FinanceBookingView {
  bookingId: string;
  clientUid: string;
  quotedAmount: number;
  currency: 'BRL';
  paymentState: string;
  providerReference?: string;
}
