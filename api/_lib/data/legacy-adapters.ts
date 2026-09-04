import type { InventoryEntry } from '../../../shared/data-contracts.js';

export interface LegacyDocument {
  collection: string;
  id: string;
  data: Record<string, unknown>;
  fingerprint: string;
}

function source(document: LegacyDocument) {
  return {
    collection: document.collection,
    documentId: document.id,
    path: `${document.collection}/${document.id}`,
    fingerprint: document.fingerprint,
  };
}

export function classifyLegacyEmployee(document: LegacyDocument): InventoryEntry {
  const data = document.data;
  if (typeof data.email !== 'string' && typeof data.name !== 'string') {
    return { source: source(document), classification: 'invalid', reasonCodes: ['MISSING_IDENTITY_FIELDS'] };
  }
  if (data.status === 'pending') {
    return {
      source: source(document), classification: 'ambiguous',
      reasonCodes: ['CANDIDATE_STAGE_NOT_INFERABLE'], destinationKind: 'candidate_application',
    };
  }
  if (data.status === 'active' || data.active === true) {
    return {
      source: source(document), classification: 'ambiguous',
      reasonCodes: ['HUMAN_APPROVAL_EVIDENCE_REQUIRED', 'OPERATION_STATE_REQUIRES_REVIEW'],
      destinationKind: 'professional',
    };
  }
  return {
    source: source(document), classification: 'ambiguous',
    reasonCodes: ['LEGACY_EMPLOYEE_STATE_UNKNOWN'],
  };
}

export function classifyLegacyUser(document: LegacyDocument): InventoryEntry {
  if (!document.id || typeof document.data !== 'object') {
    return { source: source(document), classification: 'invalid', reasonCodes: ['INVALID_USER_DOCUMENT'] };
  }
  return {
    source: source(document), classification: 'mappable', reasonCodes: [], destinationKind: 'client_profile',
  };
}

export function classifyLegacyBooking(document: LegacyDocument): InventoryEntry {
  const data = document.data;
  if (typeof data.date !== 'string') {
    return { source: source(document), classification: 'invalid', reasonCodes: ['BOOKING_DATE_MISSING'] };
  }
  return {
    source: source(document), classification: 'mappable', reasonCodes: [], destinationKind: 'legacy_booking_only',
  };
}

export function classifyLegacyDocument(document: LegacyDocument): InventoryEntry {
  if (document.collection === 'employees') return classifyLegacyEmployee(document);
  if (document.collection === 'users') return classifyLegacyUser(document);
  if (document.collection.endsWith('/bookings') || document.collection === 'reservas_index') {
    return classifyLegacyBooking(document);
  }
  return { source: source(document), classification: 'orphan', reasonCodes: ['UNSUPPORTED_SOURCE_COLLECTION'] };
}
