import { randomUUID } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { getFirebaseAdminApp } from './firebase-admin.js';
import { HttpError } from './http-errors.js';

export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const CANDIDATE_DOCUMENT_TYPES = ['identity', 'background_check', 'reference', 'other'] as const;
export const MAX_CANDIDATE_DOCUMENT_BYTES = 10 * 1024 * 1024;

export interface CandidateDocumentRequest {
  candidateUid: string;
  applicationId: string;
  documentType: 'identity' | 'background_check' | 'reference' | 'other';
  contentType: string;
  size: number;
  checksumSha256: string;
}

export interface DocumentStorageProvider {
  createUploadUrl(path: string, contentType: string, checksumSha256: string, expiresAtMs: number): Promise<string>;
  createDownloadUrl(path: string, expiresAtMs: number): Promise<string>;
  inspectObject(path: string): Promise<UploadedDocumentObject>;
}

export interface UploadedDocumentObject {
  contentType: string;
  size: number;
  checksumSha256: string;
  generation: string;
}

/**
 * Candidate documents must never silently fall back to whichever bucket happens
 * to be associated with an Admin SDK credential.  The bucket is an explicit
 * server-only operational dependency and absence fails closed.
 */
export function readDocumentStorageBucket(env: NodeJS.ProcessEnv = process.env): string {
  const bucket = env.FIREBASE_STORAGE_BUCKET?.trim() ?? '';
  if (!bucket || bucket.length > 222 || !/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(bucket)) {
    throw new HttpError(503, 'DOCUMENT_STORAGE_UNAVAILABLE', 'Candidate document storage is not configured');
  }
  return bucket;
}

export function validateCandidateDocument(input: CandidateDocumentRequest): void {
  if (!(CANDIDATE_DOCUMENT_TYPES as readonly string[]).includes(input.documentType)) {
    throw new HttpError(400, 'DOCUMENT_CATEGORY_INVALID', 'Document category is invalid');
  }
  if (!(DOCUMENT_MIME_TYPES as readonly string[]).includes(input.contentType)) {
    throw new HttpError(400, 'DOCUMENT_TYPE_NOT_ALLOWED', 'Document type is not allowed');
  }
  if (!Number.isInteger(input.size) || input.size < 1 || input.size > MAX_CANDIDATE_DOCUMENT_BYTES) {
    throw new HttpError(400, 'DOCUMENT_SIZE_INVALID', 'Document size is invalid');
  }
  if (!/^[a-f0-9]{64}$/i.test(input.checksumSha256)) {
    throw new HttpError(400, 'DOCUMENT_CHECKSUM_INVALID', 'A SHA-256 checksum is required');
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.applicationId) || !/^[A-Za-z0-9_-]{1,128}$/.test(input.candidateUid)) {
    throw new HttpError(400, 'DOCUMENT_SCOPE_INVALID', 'Document scope is invalid');
  }
}

export function createDocumentObject(input: CandidateDocumentRequest, documentId: string = randomUUID(), version: string = randomUUID()) {
  validateCandidateDocument(input);
  return {
    documentId,
    version,
    objectPath: `candidate-documents/${input.candidateUid}/${input.applicationId}/${documentId}/${version}`,
  };
}

export function validateUploadedDocumentObject(
  object: UploadedDocumentObject,
  request: Pick<CandidateDocumentRequest, 'contentType' | 'size' | 'checksumSha256'>,
): void {
  if (object.contentType !== request.contentType) {
    throw new HttpError(409, 'DOCUMENT_UPLOAD_CONTENT_TYPE_MISMATCH', 'Uploaded document content type does not match the request');
  }
  if (!Number.isInteger(object.size) || object.size !== request.size) {
    throw new HttpError(409, 'DOCUMENT_UPLOAD_SIZE_MISMATCH', 'Uploaded document size does not match the request');
  }
  if (object.checksumSha256.toLowerCase() !== request.checksumSha256.toLowerCase()) {
    throw new HttpError(409, 'DOCUMENT_UPLOAD_CHECKSUM_MISMATCH', 'Uploaded document checksum does not match the request');
  }
  if (!object.generation) {
    throw new HttpError(409, 'DOCUMENT_UPLOAD_GENERATION_MISSING', 'Uploaded document generation is missing');
  }
}

export function createFirebaseDocumentStorageProvider(env: NodeJS.ProcessEnv = process.env): DocumentStorageProvider {
  const bucket = getStorage(getFirebaseAdminApp()).bucket(readDocumentStorageBucket(env));
  return {
    async createUploadUrl(path, contentType, checksumSha256, expiresAtMs) {
      const [url] = await bucket.file(path).getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: expiresAtMs,
        contentType,
        // This header is part of the signature and is later compared by the
        // server before a download URL can ever be issued.
        extensionHeaders: { 'x-goog-meta-checksum-sha256': checksumSha256 },
        // The random object path is write-once: a retained URL cannot overwrite
        // an already completed document during its five-minute validity window.
        queryParams: { ifGenerationMatch: '0' },
      });
      return url;
    },
    async createDownloadUrl(path, expiresAtMs) {
      const [url] = await bucket.file(path).getSignedUrl({ version: 'v4', action: 'read', expires: expiresAtMs });
      return url;
    },
    async inspectObject(path) {
      const [metadata] = await bucket.file(path).getMetadata();
      return {
        contentType: String(metadata.contentType ?? ''),
        size: Number(metadata.size),
        checksumSha256: String(metadata.metadata?.['checksum-sha256'] ?? ''),
        generation: String(metadata.generation ?? ''),
      };
    },
  };
}

export function shortLivedExpiry(nowMs = Date.now()): number {
  return nowMs + 5 * 60 * 1000;
}
