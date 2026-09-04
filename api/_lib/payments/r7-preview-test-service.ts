import { timingSafeEqual } from 'node:crypto';

import { Timestamp, type Firestore } from 'firebase-admin/firestore';

import { getAdminFirestore } from '../firebase-admin.js';
import { authenticate, type AuthenticatedIdentity } from '../authenticate.js';
import { authorize } from '../authorize.js';
import { HttpError } from '../http-errors.js';
import { createExternalEffectAdapter } from './external-effect-adapter.js';

const TEST_PREFIX = 'r7_test_';
const TEST_MARKER = 'R7_TEST';
const TEST_KINDS = new Set([
  'calendar.booking_upsert', 'email.booking_confirmed', 'whatsapp.booking_event',
  'booking.reminder_schedule', 'booking.address_reveal_schedule',
]);

function sameSecret(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function assertR7PreviewTestEnvironment(env: Record<string, string | undefined>): void {
  if (env.VERCEL_ENV !== 'preview' || env.R7_TEST_MODE !== 'enabled') {
    throw new HttpError(404, 'NOT_FOUND', 'Not found');
  }
}

export function assertR7PreviewTestAccess(env: Record<string, string | undefined>, capability: string | undefined): void {
  assertR7PreviewTestEnvironment(env);
  if (!sameSecret(capability, env.R7_TEST_CAPABILITY)) throw new HttpError(404, 'NOT_FOUND', 'Not found');
}

type OwnerAuthorization = {
  uid: string;
  roles: string[];
  authzSource: 'access_grant' | 'legacy_email';
};

/**
 * Temporary R7 escape hatch: Preview only, canonical owner only, and never
 * accepts a browser-provided identity. The original capability gate remains
 * available to the pre-existing R7_TEST actions.
 */
export async function assertR7PreviewTestOwnerAccess(
  req: { headers?: Record<string, string | string[] | undefined> },
  env: Record<string, string | undefined> = process.env,
  dependencies: {
    authenticate?: (request: { headers?: Record<string, string | string[] | undefined> }) => Promise<AuthenticatedIdentity>;
    authorize?: (identity: AuthenticatedIdentity, permission: 'identity.owner.manage') => Promise<OwnerAuthorization>;
  } = {},
): Promise<void> {
  await assertR7PreviewCanonicalOwnerAccess(req, env, dependencies);
  assertR7PreviewTestEnvironment(env);
}

/** Preview-only diagnostic prerequisite. It has no payment, Firestore, or provider effect. */
export async function assertR7PreviewCanonicalOwnerAccess(
  req: { headers?: Record<string, string | string[] | undefined> },
  env: Record<string, string | undefined> = process.env,
  dependencies: {
    authenticate?: (request: { headers?: Record<string, string | string[] | undefined> }) => Promise<AuthenticatedIdentity>;
    authorize?: (identity: AuthenticatedIdentity, permission: 'identity.owner.manage') => Promise<OwnerAuthorization>;
  } = {},
): Promise<void> {
  if (env.VERCEL_ENV !== 'preview') throw new HttpError(404, 'NOT_FOUND', 'Not found');
  let identity: AuthenticatedIdentity;
  try {
    identity = await (dependencies.authenticate ?? authenticate)(req);
  } catch {
    // Deliberately indistinguishable from a route that is not available.
    throw new HttpError(404, 'NOT_FOUND', 'Not found');
  }

  let actor: OwnerAuthorization;
  try {
    actor = await (dependencies.authorize ?? authorize)(identity, 'identity.owner.manage');
  } catch (error) {
    if (error instanceof HttpError && error.status === 503) throw error;
    throw new HttpError(403, 'PERMISSION_DENIED', 'Permission denied');
  }

  if (actor.authzSource !== 'access_grant' || !actor.roles.includes('owner')) {
    throw new HttpError(403, 'PERMISSION_DENIED', 'Permission denied');
  }
}

function assertFixture(job: FirebaseFirestore.DocumentData, jobId: string): void {
  if (
    job.testMarker !== TEST_MARKER || !jobId.startsWith(TEST_PREFIX) ||
    !String(job.bookingId ?? '').startsWith(TEST_PREFIX) ||
    !String(job.orderId ?? '').startsWith(TEST_PREFIX) || !TEST_KINDS.has(String(job.kind))
  ) throw new HttpError(400, 'R7_TEST_FIXTURE_INVALID', 'Invalid R7 test fixture');
}

export async function processR7PreviewTestJob(input: {
  jobId: string;
  now?: Date;
  workerId?: string;
}, db: Firestore = getAdminFirestore(), env: Record<string, string | undefined> = process.env): Promise<{ state: string; providerReference?: string }> {
  if (!input.jobId.startsWith(TEST_PREFIX)) throw new HttpError(400, 'R7_TEST_FIXTURE_INVALID', 'Invalid R7 test job');
  const nowDate = input.now ?? new Date(); const now = Timestamp.fromDate(nowDate);
  const ref = db.collection('r7_test_outbox_jobs').doc(input.jobId);
  const leased = await db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists) throw new HttpError(404, 'R7_TEST_JOB_NOT_FOUND', 'R7 test job not found');
    const job = current.data()!; assertFixture(job, input.jobId);
    if (job.state === 'succeeded') return false;
    if (!['pending', 'retryable'].includes(String(job.state))) throw new HttpError(409, 'R7_TEST_JOB_NOT_DUE', 'R7 test job is not runnable');
    const due = job.nextAttemptAt instanceof Timestamp ? job.nextAttemptAt.toDate() : undefined;
    if (!due || due.getTime() > nowDate.getTime()) throw new HttpError(409, 'R7_TEST_JOB_NOT_DUE', 'R7 test job is not due');
    tx.update(ref, { state: 'processing', workerId: input.workerId ?? 'r7-preview-test', leaseUntil: Timestamp.fromDate(new Date(nowDate.getTime() + 60_000)), updatedAt: now });
    return true;
  });
  if (!leased) return { state: 'succeeded' };
  const snapshot = await ref.get(); const job = snapshot.data()!;
  try {
    if (job.forceFailure === true) throw new HttpError(502, 'R7_TEST_FORCED_FAILURE', 'Forced R7 test failure');
    let providerReference: string;
    if (['booking.reminder_schedule', 'booking.address_reveal_schedule'].includes(String(job.kind))) {
      providerReference = `r7_test_scheduler:${String(job.kind)}:${String(job.dedupeKey)}`;
    } else {
      providerReference = (await createExternalEffectAdapter(env).execute({ ...job, r7Test: true })).providerReference;
    }
    await ref.update({ state: 'succeeded', providerReference, attempts: Number(job.attempts ?? 0) + 1, leaseUntil: null, updatedAt: now });
    return { state: 'succeeded', providerReference };
  } catch (error) {
    const attempts = Number(job.attempts ?? 0) + 1; const terminal = attempts >= 5;
    await ref.update({
      state: terminal ? 'dead_letter' : 'retryable', attempts, leaseUntil: null,
      nextAttemptAt: Timestamp.fromDate(new Date(nowDate.getTime() + Math.min(2 ** attempts * 60_000, 3_600_000))),
      lastErrorCode: error instanceof HttpError ? error.code : 'R7_TEST_EXTERNAL_EFFECT_FAILED', updatedAt: now,
    });
    return { state: terminal ? 'dead_letter' : 'retryable' };
  }
}
