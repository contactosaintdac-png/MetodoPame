import admin from 'firebase-admin';
import { getAdminFirestore } from './firebase-admin.js';
import { HttpError } from './http-errors.js';

export type AuditOutcome = 'intent' | 'completed' | 'failed';
export interface PrivilegedAccessDescriptor {
  actorUid: string;
  permission: string;
  action: string;
  resourceType: string;
  resourceId: string;
  reason: string;
  requestId: string;
}
export interface AuditSink {
  append(entry: PrivilegedAccessDescriptor & { outcome: AuditOutcome; resultCount?: number; errorCode?: string }): Promise<void>;
}

function validateDescriptor(value: PrivilegedAccessDescriptor): void {
  for (const [key, content, max] of [
    ['actorUid', value.actorUid, 128], ['permission', value.permission, 128], ['action', value.action, 160],
    ['resourceType', value.resourceType, 120], ['resourceId', value.resourceId, 256],
    ['reason', value.reason, 500], ['requestId', value.requestId, 128],
  ] as const) {
    if (!content || content.length > max) throw new HttpError(400, 'AUDIT_DESCRIPTOR_INVALID', `Invalid audit ${key}`);
  }
}

export function createFirestoreAuditSink(): AuditSink {
  return {
    async append(entry) {
      await getAdminFirestore().collection('audit_log').add({ ...entry, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    },
  };
}

export async function withAuditedAdminAccess<T>(
  descriptor: PrivilegedAccessDescriptor,
  operation: () => Promise<T>,
  options: { audit?: AuditSink; resultCount?: (result: T) => number } = {},
): Promise<T> {
  validateDescriptor(descriptor); const audit = options.audit ?? createFirestoreAuditSink();
  // Fail closed before touching sensitive data if the intent cannot be recorded.
  await audit.append({ ...descriptor, outcome: 'intent' });
  try {
    const result = await operation();
    await audit.append({ ...descriptor, outcome: 'completed', ...(options.resultCount ? { resultCount: options.resultCount(result) } : {}) });
    return result;
  } catch (error) {
    try {
      await audit.append({ ...descriptor, outcome: 'failed', errorCode: error instanceof HttpError ? error.code : 'INTERNAL_ERROR' });
    } catch {
      // Preserve the original operation failure; the intent entry already exists.
    }
    throw error;
  }
}
