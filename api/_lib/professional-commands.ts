import admin from 'firebase-admin';
import { resolvePermissions, type Role } from '../../shared/authz.js';
import {
  assignmentPriority, canReceiveServices, canTransition,
  type ApprovalState, type CandidateApplicationState, type CertificationState, type OperationalState,
  type TrainingState,
} from '../../shared/professional-domain.js';
import { getAdminFirestore } from './firebase-admin.js';
import { HttpError } from './http-errors.js';

const now = admin.firestore.FieldValue.serverTimestamp();
const DEFAULT_CANDIDATE_GRANT = (roles: Role[]) => ({
  schemaVersion: 1, active: true, roles,
  effectivePermissions: [...resolvePermissions(roles)], permissionsVersion: 2,
  claimSyncState: 'pending', updatedAt: now,
});

function audit(tx: FirebaseFirestore.Transaction, actorUid: string, action: string, target: string, metadata: Record<string, unknown> = {}) {
  tx.create(getAdminFirestore().collection('audit_log').doc(), {
    actorUid, action, target, metadata, createdAt: now,
  });
}

export async function submitCandidateApplication(input: {
  candidateUid: string; candidateEmail?: string; name: string; whatsapp: string;
  experience?: string; zones?: string; actorUid: string;
}): Promise<{ applicationId: string }> {
  const db = getAdminFirestore();
  const applicationRef = db.collection('candidate_applications').doc();
  const currentRef = db.collection('candidate_application_current').doc(input.candidateUid);
  const privateRef = db.collection('candidate_private').doc(applicationRef.id);
  const selfViewRef = db.collection('candidate_self_views').doc(input.candidateUid).collection('applications').doc(applicationRef.id);
  await db.runTransaction(async (tx) => {
    const current = await tx.get(currentRef);
    if (current.exists) throw new HttpError(409, 'CANDIDATE_APPLICATION_ALREADY_OPEN', 'An open application already exists');
    tx.create(applicationRef, {
      schemaVersion: 1, candidateUid: input.candidateUid,
      state: 'submitted', cafe: { state: 'not_scheduled' }, documents: { state: 'not_started' },
      verification: { state: 'not_started' }, decision: null, createdAt: now, updatedAt: now,
    });
    tx.create(privateRef, {
      schemaVersion: 1, applicationId: applicationRef.id, candidateUid: input.candidateUid,
      email: input.candidateEmail ?? null, name: input.name, whatsapp: input.whatsapp,
      experience: input.experience ?? '', zones: input.zones ?? '', createdAt: now, updatedAt: now,
    });
    tx.create(selfViewRef, {
      schemaVersion: 1, applicationId: applicationRef.id, state: 'submitted', cafeState: 'not_scheduled',
      documentsState: 'not_started', verificationState: 'not_started', createdAt: now, updatedAt: now,
    });
    tx.create(currentRef, { applicationId: applicationRef.id, candidateUid: input.candidateUid, state: 'submitted', createdAt: now });
    tx.set(db.collection('access_grants').doc(input.candidateUid), DEFAULT_CANDIDATE_GRANT(['candidate']), { merge: true });
    audit(tx, input.actorUid, 'candidate_application.submitted', `candidate_applications/${applicationRef.id}`);
  });
  return { applicationId: applicationRef.id };
}

export async function transitionCandidateApplication(input: {
  applicationId: string; nextState: CandidateApplicationState; actorUid: string;
}): Promise<void> {
  const db = getAdminFirestore(); const ref = db.collection('candidate_applications').doc(input.applicationId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref); if (!snap.exists) throw new HttpError(404, 'CANDIDATE_NOT_FOUND', 'Candidate application not found');
    const data = snap.data()!; const current = String(data.state);
    if (!canTransition(current, input.nextState)) throw new HttpError(409, 'INVALID_CANDIDATE_TRANSITION', 'Invalid candidate transition');
    tx.update(ref, { state: input.nextState, updatedAt: now });
    tx.set(db.collection('candidate_application_current').doc(String(data.candidateUid)), { state: input.nextState }, { merge: true });
    tx.set(db.collection('candidate_self_views').doc(String(data.candidateUid)).collection('applications').doc(input.applicationId), { state: input.nextState, updatedAt: now }, { merge: true });
    audit(tx, input.actorUid, 'candidate_application.transitioned', `candidate_applications/${input.applicationId}`, { from: current, to: input.nextState });
  });
}

export async function recordCandidateReview(input: {
  applicationId: string; cafeState?: 'completed' | 'no_show'; documentsVerified?: boolean; verificationVerified?: boolean; actorUid: string;
}): Promise<void> {
  const db = getAdminFirestore(); const ref = db.collection('candidate_applications').doc(input.applicationId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref); if (!snap.exists) throw new HttpError(404, 'CANDIDATE_NOT_FOUND', 'Candidate application not found');
    const data = snap.data()!;
    if (['approved', 'rejected', 'withdrawn'].includes(String(data.state))) throw new HttpError(409, 'CANDIDATE_STATE_INVALID', 'Terminal applications cannot be reviewed');
    const update: Record<string, unknown> = { updatedAt: now };
    if (input.cafeState) update.cafe = { ...(data.cafe ?? {}), state: input.cafeState, reviewedBy: input.actorUid, reviewedAt: now };
    if (input.documentsVerified !== undefined) update.documents = { ...(data.documents ?? {}), state: input.documentsVerified ? 'verified' : 'needs_review', reviewedBy: input.actorUid, reviewedAt: now };
    if (input.verificationVerified !== undefined) update.verification = { ...(data.verification ?? {}), state: input.verificationVerified ? 'verified' : 'needs_review', reviewedBy: input.actorUid, reviewedAt: now };
    tx.update(ref, update);
    const selfUpdate: Record<string, unknown> = { updatedAt: now };
    if (input.cafeState) selfUpdate.cafeState = input.cafeState;
    if (input.documentsVerified !== undefined) selfUpdate.documentsState = input.documentsVerified ? 'verified' : 'needs_review';
    if (input.verificationVerified !== undefined) selfUpdate.verificationState = input.verificationVerified ? 'verified' : 'needs_review';
    tx.set(db.collection('candidate_self_views').doc(String(data.candidateUid)).collection('applications').doc(input.applicationId), selfUpdate, { merge: true });
    audit(tx, input.actorUid, 'candidate_application.review_recorded', `candidate_applications/${input.applicationId}`);
  });
}

export async function decideCandidateApplication(input: {
  applicationId: string; decision: 'approved' | 'rejected'; actorUid: string; reason: string;
}): Promise<{ uid?: string }> {
  const db = getAdminFirestore(); const appRef = db.collection('candidate_applications').doc(input.applicationId);
  let uid: string | undefined;
  await db.runTransaction(async (tx) => {
    const app = await tx.get(appRef); if (!app.exists) throw new HttpError(404, 'CANDIDATE_NOT_FOUND', 'Candidate application not found');
    const data = app.data()!; uid = String(data.candidateUid);
    const privateRef = db.collection('candidate_private').doc(input.applicationId);
    const privateSnap = input.decision === 'approved' ? await tx.get(privateRef) : null;
    if (data.state !== 'under_review') throw new HttpError(409, 'CANDIDATE_NOT_READY_FOR_DECISION', 'Candidate must be under review');
    if (input.decision === 'approved' && (data.cafe?.state !== 'completed' || data.documents?.state !== 'verified' || data.verification?.state !== 'verified')) {
      throw new HttpError(409, 'CANDIDATE_REQUIREMENTS_INCOMPLETE', 'Required review steps are incomplete');
    }
    tx.update(appRef, {
      state: input.decision,
      decision: {
        state: input.decision,
        decidedByAuthorizedHuman: { actorUid: input.actorUid, decidedAt: now },
      },
      updatedAt: now,
    });
    tx.delete(db.collection('candidate_application_current').doc(uid));
    tx.set(db.collection('candidate_self_views').doc(uid).collection('applications').doc(input.applicationId), { state: input.decision, decisionState: input.decision, updatedAt: now }, { merge: true });
    if (input.decision === 'approved') {
      if (!privateSnap?.exists) throw new HttpError(409, 'CANDIDATE_PRIVATE_DATA_MISSING', 'Candidate private data requires reconciliation');
      const privateData = privateSnap.data() ?? {};
      const lifecycle = { approval: { state: 'approved' as const }, operations: { state: 'inactive' as const }, training: { state: 'not_started' as const }, certification: { state: 'not_certified' as const } };
      tx.create(db.collection('professionals').doc(uid), { schemaVersion: 1, uid, applicationId: input.applicationId, lifecycle, createdAt: now, updatedAt: now });
      tx.create(db.collection('professional_private').doc(uid), {
        schemaVersion: 1, professionalUid: uid, applicationId: input.applicationId,
        email: privateData.email ?? null, whatsapp: privateData.whatsapp ?? null, createdAt: now, updatedAt: now,
      });
      tx.create(db.collection('professional_profiles').doc(uid), {
        schemaVersion: 1, professionalUid: uid, displayName: privateData.name ?? 'Profissional',
        zones: privateData.zones ?? '', createdAt: now, updatedAt: now,
      });
      tx.create(db.collection('professional_self_views').doc(uid), {
        schemaVersion: 1, professionalUid: uid, lifecycle, eligibleForService: false,
        assignmentPriority: 0, createdAt: now, updatedAt: now,
      });
      tx.create(db.collection('professional_capacity').doc(uid), { professionalId: uid, eligibleForService: canReceiveServices(lifecycle), assignmentPriority: assignmentPriority(lifecycle), weeklyAvailability: [], updatedAt: now });
      tx.set(db.collection('access_grants').doc(uid), DEFAULT_CANDIDATE_GRANT(['professional']), { merge: true });
    }
    audit(tx, input.actorUid, `candidate_application.${input.decision}`, `candidate_applications/${input.applicationId}`, {
      candidateUid: uid,
      reason: input.reason,
      approvedByAuthorizedHuman: input.decision === 'approved',
    });
  });
  return { uid };
}

export async function updateProfessionalLifecycle(input: {
  professionalUid: string; field: 'approval' | 'operations' | 'training' | 'certification'; nextState: ApprovalState | OperationalState | TrainingState | CertificationState; actorUid: string; reason: string;
}): Promise<void> {
  const db = getAdminFirestore(); const ref = db.collection('professionals').doc(input.professionalUid);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref); if (!snap.exists) throw new HttpError(404, 'PROFESSIONAL_NOT_FOUND', 'Professional not found');
    const data = snap.data()!; const current = String(data.lifecycle?.[input.field]?.state ?? '');
    if (!canTransition(current, input.nextState)) throw new HttpError(409, 'INVALID_PROFESSIONAL_TRANSITION', 'Invalid professional transition');
    const lifecycle = { ...data.lifecycle, [input.field]: { state: input.nextState } };
    const capacity = { professionalId: input.professionalUid, eligibleForService: canReceiveServices(lifecycle), assignmentPriority: assignmentPriority(lifecycle), updatedAt: now };
    tx.update(ref, { lifecycle, updatedAt: now });
    tx.set(db.collection('professional_capacity').doc(input.professionalUid), capacity, { merge: true });
    tx.set(db.collection('professional_self_views').doc(input.professionalUid), { lifecycle, eligibleForService: capacity.eligibleForService, assignmentPriority: capacity.assignmentPriority, updatedAt: now }, { merge: true });
    audit(tx, input.actorUid, `professional.${input.field}.transitioned`, `professionals/${input.professionalUid}`, {
      from: current,
      to: input.nextState,
      reason: input.reason,
    });
  });
}
