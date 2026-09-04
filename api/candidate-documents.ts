import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { randomUUID } from 'node:crypto';
import { authenticate } from './_lib/authenticate.js';
import { authorize } from './_lib/authorize.js';
import { withAuditedAdminAccess } from './_lib/audited-admin.js';
import { createDocumentObject, createFirebaseDocumentStorageProvider, shortLivedExpiry, validateCandidateDocument, validateUploadedDocumentObject } from './_lib/document-storage.js';
import { getAdminFirestore } from './_lib/firebase-admin.js';
import { applyNoStore } from './_lib/http-policy.js';
import { HttpError, toHttpError } from './_lib/http-errors.js';
import { requireObject, requireResourceId, requireString } from './_lib/request-validation.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyNoStore(res);
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
    const identity = await authenticate(req); const body = requireObject(req.body); const action = requireString(body.action, 'action');
    const applicationId = requireResourceId(body.applicationId, 'applicationId');
    const actor = await authorize(identity, ['profile.candidate.manage_self', 'candidates.review'], { requirementMode: 'any' });
    const requestId = typeof req.headers['x-request-id'] === 'string' ? req.headers['x-request-id'] : randomUUID();
    const db = getAdminFirestore();
    const application = await withAuditedAdminAccess({
      actorUid: actor.uid, permission: actor.permissions.includes('candidates.review') ? 'candidates.review' : 'profile.candidate.manage_self',
      action: 'candidate.application.document_context.read', resourceType: 'candidate_application', resourceId: applicationId,
      reason: action, requestId,
    }, () => db.collection('candidate_applications').doc(applicationId).get());
    if (!application.exists) throw new HttpError(404, 'CANDIDATE_NOT_FOUND', 'Candidate application not found');
    const candidateUid = String(application.get('candidateUid'));
    const isOwner = candidateUid === identity.uid;
    if (action === 'prepare-upload') {
      if (!isOwner) throw new HttpError(403, 'PERMISSION_DENIED', 'Permission denied');
      const request = {
        candidateUid, applicationId,
        documentType: requireString(body.documentType, 'documentType') as 'identity' | 'background_check' | 'reference' | 'other',
        contentType: requireString(body.contentType, 'contentType'), size: Number(body.size),
        checksumSha256: requireString(body.checksumSha256, 'checksumSha256'),
      };
      validateCandidateDocument(request); const object = createDocumentObject(request); const expiresAt = shortLivedExpiry();
      const uploadUrl = await withAuditedAdminAccess({
        actorUid: actor.uid, permission: 'profile.candidate.manage_self', action: 'candidate.document.upload_url.issue',
        resourceType: 'candidate_document', resourceId: object.documentId, reason: 'Candidate requested a versioned upload URL', requestId,
      }, async () => {
        await db.collection('candidate_document_metadata').doc(object.documentId).set({
          ...object, candidateUid, applicationId, documentType: request.documentType, contentType: request.contentType,
          size: request.size, checksumSha256: request.checksumSha256, state: 'pending_upload', createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return createFirebaseDocumentStorageProvider().createUploadUrl(object.objectPath, request.contentType, request.checksumSha256, expiresAt);
      });
      return res.status(200).json({
        documentId: object.documentId,
        version: object.version,
        uploadUrl,
        expiresAt,
        requiredHeaders: { 'Content-Type': request.contentType, 'x-goog-meta-checksum-sha256': request.checksumSha256 },
      });
    }
    if (action === 'complete-upload') {
      if (!isOwner) throw new HttpError(403, 'PERMISSION_DENIED', 'Permission denied');
      const documentId = requireResourceId(body.documentId, 'documentId');
      const metadata = await withAuditedAdminAccess({
        actorUid: actor.uid, permission: 'profile.candidate.manage_self', action: 'candidate.document.metadata.read',
        resourceType: 'candidate_document', resourceId: documentId, reason: 'Candidate completed an upload', requestId,
      }, () => db.collection('candidate_document_metadata').doc(documentId).get());
      if (!metadata.exists || metadata.get('applicationId') !== applicationId || metadata.get('candidateUid') !== candidateUid) {
        throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
      }
      if (metadata.get('state') !== 'pending_upload') {
        throw new HttpError(409, 'DOCUMENT_UPLOAD_ALREADY_COMPLETED', 'Document upload has already been completed');
      }
      const request = {
        contentType: String(metadata.get('contentType')),
        size: Number(metadata.get('size')),
        checksumSha256: String(metadata.get('checksumSha256')),
      };
      const uploaded = await withAuditedAdminAccess({
        actorUid: actor.uid, permission: 'profile.candidate.manage_self', action: 'candidate.document.object.verify',
        resourceType: 'candidate_document', resourceId: documentId, reason: 'Verify uploaded object before making it available', requestId,
      }, () => createFirebaseDocumentStorageProvider().inspectObject(String(metadata.get('objectPath'))));
      validateUploadedDocumentObject(uploaded, request);
      await withAuditedAdminAccess({
        actorUid: actor.uid, permission: 'profile.candidate.manage_self', action: 'candidate.document.upload.complete',
        resourceType: 'candidate_document', resourceId: documentId, reason: 'Mark an inspected upload available for review', requestId,
      }, () => db.collection('candidate_document_metadata').doc(documentId).update({
        state: 'uploaded', objectGeneration: uploaded.generation, uploadedAt: admin.firestore.FieldValue.serverTimestamp(),
      }));
      return res.status(200).json({ documentId, state: 'uploaded' });
    }
    if (action === 'prepare-download') {
      if (!isOwner && !actor.permissions.includes('candidates.review')) throw new HttpError(403, 'PERMISSION_DENIED', 'Permission denied');
      const documentId = requireResourceId(body.documentId, 'documentId');
      const permission = isOwner ? 'profile.candidate.manage_self' : 'candidates.review';
      const metadata = await withAuditedAdminAccess({
        actorUid: actor.uid, permission, action: 'candidate.document.metadata.read', resourceType: 'candidate_document',
        resourceId: documentId, reason: isOwner ? 'Candidate requested own document' : 'Authorized candidate review', requestId,
      }, () => db.collection('candidate_document_metadata').doc(documentId).get());
      if (!metadata.exists || metadata.get('applicationId') !== applicationId || metadata.get('candidateUid') !== candidateUid) {
        throw new HttpError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
      }
      if (metadata.get('state') !== 'uploaded') throw new HttpError(409, 'DOCUMENT_NOT_AVAILABLE', 'Document upload has not been verified');
      const request = {
        contentType: String(metadata.get('contentType')),
        size: Number(metadata.get('size')),
        checksumSha256: String(metadata.get('checksumSha256')),
      };
      const uploaded = await withAuditedAdminAccess({
        actorUid: actor.uid, permission, action: 'candidate.document.object.reverify', resourceType: 'candidate_document',
        resourceId: documentId, reason: 'Verify object integrity before issuing download URL', requestId,
      }, () => createFirebaseDocumentStorageProvider().inspectObject(String(metadata.get('objectPath'))));
      validateUploadedDocumentObject(uploaded, request);
      if (uploaded.generation !== String(metadata.get('objectGeneration') ?? '')) {
        throw new HttpError(409, 'DOCUMENT_UPLOAD_GENERATION_MISMATCH', 'Uploaded document changed after verification');
      }
      const expiresAt = shortLivedExpiry();
      const downloadUrl = await withAuditedAdminAccess({
        actorUid: actor.uid, permission, action: 'candidate.document.download_url.issue', resourceType: 'candidate_document',
        resourceId: documentId, reason: isOwner ? 'Candidate requested own document' : 'Authorized candidate review', requestId,
      }, () => createFirebaseDocumentStorageProvider().createDownloadUrl(String(metadata.get('objectPath')), expiresAt));
      return res.status(200).json({ documentId, downloadUrl, expiresAt });
    }
    throw new HttpError(400, 'INVALID_ACTION', 'Invalid action');
  } catch (error) { const httpError = toHttpError(error); return res.status(httpError.status).json({ error: httpError.code, message: httpError.message }); }
}
