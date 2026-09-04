/**
 * Canonical lifecycle vocabulary for recruitment and professionals.
 * These states are deliberately independent: certification is not authorization
 * and never makes somebody operationally eligible by itself.
 */
export const CANDIDATE_APPLICATION_STATES = [
  'submitted', 'screening', 'under_review', 'approved', 'rejected', 'withdrawn',
] as const;
export type CandidateApplicationState = (typeof CANDIDATE_APPLICATION_STATES)[number];

export const CAFE_STATES = ['not_scheduled', 'scheduled', 'completed', 'no_show', 'cancelled'] as const;
export type CafeState = (typeof CAFE_STATES)[number];

export const APPROVAL_STATES = ['approved', 'revoked'] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];
export const OPERATIONAL_STATES = ['inactive', 'active', 'suspended', 'offboarded'] as const;
export type OperationalState = (typeof OPERATIONAL_STATES)[number];
export const TRAINING_STATES = ['not_started', 'in_progress', 'completed'] as const;
export type TrainingState = (typeof TRAINING_STATES)[number];
export const CERTIFICATION_STATES = ['not_certified', 'certified', 'revoked'] as const;
export type CertificationState = (typeof CERTIFICATION_STATES)[number];

export interface ProfessionalLifecycle {
  approval: { state: ApprovalState };
  operations: { state: OperationalState };
  training: { state: TrainingState };
  certification: { state: CertificationState };
}

const transitions: Record<string, readonly string[]> = {
  submitted: ['screening', 'withdrawn'],
  screening: ['under_review', 'rejected', 'withdrawn'],
  under_review: ['approved', 'rejected', 'withdrawn'],
  approved: ['revoked'],
  not_scheduled: ['scheduled'],
  scheduled: ['completed', 'no_show', 'cancelled'],
  inactive: ['active', 'offboarded'],
  active: ['suspended', 'offboarded'],
  suspended: ['active', 'offboarded'],
  not_started: ['in_progress'],
  in_progress: ['completed'],
  not_certified: ['certified'],
  certified: ['revoked'],
};

export function canTransition(from: string, to: string): boolean {
  return transitions[from]?.includes(to) ?? false;
}

export function canReceiveServices(lifecycle: ProfessionalLifecycle): boolean {
  return lifecycle.approval.state === 'approved' && lifecycle.operations.state === 'active';
}

export function assignmentPriority(lifecycle: ProfessionalLifecycle): {
  tier: 'certified' | 'approved' | 'ineligible';
  order: 0 | 1 | 99;
} {
  if (!canReceiveServices(lifecycle)) return { tier: 'ineligible', order: 99 };
  return lifecycle.certification.state === 'certified'
    ? { tier: 'certified', order: 0 }
    : { tier: 'approved', order: 1 };
}
