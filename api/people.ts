import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';
import { withAuditedAdminAccess } from './_lib/audited-admin.js';
import { authenticate } from './_lib/authenticate.js';
import { authorize } from './_lib/authorize.js';
import { getAdminFirestore } from './_lib/firebase-admin.js';
import { syncGrantClaims } from './_lib/claim-sync.js';
import { decideCandidateApplication, recordCandidateReview, submitCandidateApplication, transitionCandidateApplication, updateProfessionalLifecycle } from './_lib/professional-commands.js';
import { applyNoStore } from './_lib/http-policy.js';
import { HttpError, toHttpError } from './_lib/http-errors.js';
import { requireObject, requireResourceId, requireString } from './_lib/request-validation.js';
import { readDataModelFlags } from './_lib/data/feature-flags.js';

const allowed = new Set(['candidate.submit', 'candidate.transition', 'candidate.review', 'candidate.decide', 'candidate.list', 'professional.list', 'person.get', 'professional.transition', 'claims.retry']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyNoStore(res); if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    const identity = await authenticate(req); const body = requireObject(req.body); const action = requireString(body.action, 'action');
    if (!allowed.has(action)) throw new HttpError(400, 'INVALID_ACTION', 'Invalid action');
    if (action === 'candidate.submit') {
      const result = await submitCandidateApplication({ candidateUid: identity.uid, candidateEmail: identity.email, name: requireString(body.name, 'name'), whatsapp: requireString(body.whatsapp, 'whatsapp'), experience: typeof body.experience === 'string' ? body.experience : undefined, zones: typeof body.zones === 'string' ? body.zones : undefined, actorUid: identity.uid });
      const claimSyncState = await syncGrantClaims(identity.uid); return res.status(201).json({ ...result, claimSyncState });
    }
    if (action === 'candidate.list') {
      const actor = await authorize(identity, 'candidates.review'); const db = getAdminFirestore();
      const state = typeof body.state === 'string' && body.state.length <= 40 ? body.state : null;
      const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : randomUUID();
      const items = await withAuditedAdminAccess({
        actorUid: actor.uid, permission: 'candidates.review', action: 'candidate.list.read', resourceType: 'candidate_application',
        resourceId: state ?? 'all', reason: 'Canonical Admin candidate list', requestId,
      }, async () => {
        let query: FirebaseFirestore.Query = db.collection('candidate_applications');
        if (state) query = query.where('state', '==', state);
        const applications = await query.orderBy('createdAt', 'desc').limit(100).get();
        const privateDocuments = await Promise.all(applications.docs.map((doc) => db.collection('candidate_private').doc(doc.id).get()));
        return applications.docs.map((doc, index) => ({ id: doc.id, ...doc.data(), private: privateDocuments[index].exists ? privateDocuments[index].data() : null }));
      }, { resultCount: (result) => result.length });
      return res.status(200).json({ items });
    }
    if (action === 'professional.list') {
      const actor = await authorize(identity, 'professionals.read'); const db = getAdminFirestore();
      const readMode = readDataModelFlags().peopleReadMode;
      const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : randomUUID();
      const items = await withAuditedAdminAccess({
        actorUid: actor.uid, permission: 'professionals.read', action: 'professional.list.read', resourceType: 'professional',
        resourceId: 'all', reason: 'Canonical Admin professional list', requestId,
      }, async () => {
        if (readMode === 'legacy') {
          const employees = await db.collection('employees').orderBy('createdAt', 'desc').limit(100).get();
          return employees.docs.map((doc) => ({ id: doc.id, legacy: true, eligibility: 'unknown_legacy', profile: doc.data() }));
        }
        const professionals = await db.collection('professionals').orderBy('createdAt', 'desc').limit(100).get();
        const profiles = await Promise.all(professionals.docs.map((doc) => db.collection('professional_profiles').doc(doc.id).get()));
        const canonical = professionals.docs.map((doc, index) => ({ id: doc.id, ...doc.data(), profile: profiles[index].exists ? profiles[index].data() : null }));
        if (readMode !== 'dual') return canonical;
        const employees = await db.collection('employees').orderBy('createdAt', 'desc').limit(100).get();
        const mapped = new Set(canonical.map((item) => item.id));
        return [...canonical, ...employees.docs.filter((doc) => !mapped.has(doc.id)).map((doc) => ({ id: doc.id, legacy: true, eligibility: 'unknown_legacy', profile: doc.data() }))];
      }, { resultCount: (result) => result.length });
      return res.status(200).json({ items });
    }
    if (action === 'person.get') {
      const kind = requireString(body.kind, 'kind'); const id = requireResourceId(body.id, 'id'); const db = getAdminFirestore();
      const permission = kind === 'candidate' ? 'candidates.review' : kind === 'professional' ? 'professionals.read' : null;
      if (!permission) throw new HttpError(400, 'INVALID_KIND', 'Invalid person kind');
      const actor = await authorize(identity, permission); const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : randomUUID();
      const record = await withAuditedAdminAccess({
        actorUid: actor.uid, permission, action: `${kind}.canonical_file.read`, resourceType: kind, resourceId: id,
        reason: 'Canonical Admin person file', requestId,
      }, async () => {
        if (kind === 'candidate') {
          const [application, privateData, verification, documents, legacy, oldAudit, newAudit] = await Promise.all([
            db.collection('candidate_applications').doc(id).get(), db.collection('candidate_private').doc(id).get(),
            db.collection('candidate_verifications').doc(id).get(), db.collection('candidate_document_metadata').where('applicationId', '==', id).limit(100).get(),
            db.collection('employees').where('applicationId', '==', id).limit(10).get(),
            db.collection('audit_log').where('target', '==', `candidate_applications/${id}`).limit(50).get(),
            db.collection('audit_log').where('resourceId', '==', id).limit(50).get(),
          ]);
          if (!application.exists) throw new HttpError(404, 'CANDIDATE_NOT_FOUND', 'Candidate application not found');
          return { id, application: application.data(), private: privateData.exists ? privateData.data() : null, verification: verification.exists ? verification.data() : null, documents: documents.docs.map((doc) => ({ id: doc.id, ...doc.data() })), legacy: legacy.docs.map((doc) => ({ id: doc.id, ...doc.data() })), audit: [...oldAudit.docs, ...newAudit.docs].map((doc) => ({ id: doc.id, ...doc.data() })) };
        }
        const [professional, privateData, profile, capacity, legacy, oldAudit, newAudit] = await Promise.all([
          db.collection('professionals').doc(id).get(), db.collection('professional_private').doc(id).get(),
          db.collection('professional_profiles').doc(id).get(), db.collection('professional_capacity').doc(id).get(),
          db.collection('employees').doc(id).get(), db.collection('audit_log').where('target', '==', `professionals/${id}`).limit(50).get(),
          db.collection('audit_log').where('resourceId', '==', id).limit(50).get(),
        ]);
        if (!professional.exists) throw new HttpError(404, 'PROFESSIONAL_NOT_FOUND', 'Professional not found');
        return { id, professional: professional.data(), private: privateData.exists ? privateData.data() : null, profile: profile.exists ? profile.data() : null, capacity: capacity.exists ? capacity.data() : null, legacy: legacy.exists ? { id: legacy.id, ...legacy.data() } : null, audit: [...oldAudit.docs, ...newAudit.docs].map((doc) => ({ id: doc.id, ...doc.data() })) };
      });
      return res.status(200).json({ record });
    }
    if (action === 'candidate.transition') {
      const actor = await authorize(identity, 'candidates.review'); await transitionCandidateApplication({ applicationId: requireResourceId(body.applicationId, 'applicationId'), nextState: requireString(body.nextState, 'nextState') as never, actorUid: actor.uid }); return res.status(200).json({ ok: true });
    }
    if (action === 'candidate.review') {
      const actor = await authorize(identity, 'candidates.review');
      await recordCandidateReview({ applicationId: requireResourceId(body.applicationId, 'applicationId'), actorUid: actor.uid,
        ...(body.cafeState === 'completed' || body.cafeState === 'no_show' ? { cafeState: body.cafeState } : {}),
        ...(typeof body.documentsVerified === 'boolean' ? { documentsVerified: body.documentsVerified } : {}),
        ...(typeof body.verificationVerified === 'boolean' ? { verificationVerified: body.verificationVerified } : {}),
      });
      return res.status(200).json({ ok: true });
    }
    if (action === 'candidate.decide') {
      const actor = await authorize(identity, 'candidates.decide'); const result = await decideCandidateApplication({ applicationId: requireResourceId(body.applicationId, 'applicationId'), decision: requireString(body.decision, 'decision') as 'approved' | 'rejected', actorUid: actor.uid, reason: requireString(body.reason, 'reason', { min: 3, max: 500 }) });
      const claimSyncState = result.uid ? await syncGrantClaims(result.uid) : null; return res.status(200).json({ ok: true, claimSyncState });
    }
    if (action === 'professional.transition') {
      const field = requireString(body.field, 'field'); const permission = field === 'training' || field === 'certification' ? 'training.certify' : 'professionals.manage'; const actor = await authorize(identity, permission);
      await updateProfessionalLifecycle({ professionalUid: requireResourceId(body.professionalUid, 'professionalUid'), field: field as 'approval' | 'operations' | 'training' | 'certification', nextState: requireString(body.nextState, 'nextState') as never, actorUid: actor.uid, reason: requireString(body.reason, 'reason', { min: 3, max: 500 }) }); return res.status(200).json({ ok: true });
    }
    const actor = await authorize(identity, 'identity.grants.manage_non_owner'); const uid = requireResourceId(body.uid, 'uid');
    if (uid === actor.uid) throw new HttpError(403, 'OWNER_RECOVERY_REQUIRED', 'Use owner recovery for your own grant');
    return res.status(200).json({ ok: true, claimSyncState: await syncGrantClaims(uid) });
  } catch (error) { const httpError = toHttpError(error); return res.status(httpError.status).json({ error: httpError.code, message: httpError.message }); }
}
