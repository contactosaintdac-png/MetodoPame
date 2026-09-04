import assert from 'node:assert/strict';
import test from 'node:test';

import { HttpError } from '../../api/_lib/http-errors.js';
import { assertR7PreviewTestOwnerAccess } from '../../api/_lib/payments/r7-preview-test-service.js';

const env = { VERCEL_ENV: 'preview', R7_TEST_MODE: 'enabled' };
const ownerIdentity = { uid: 'owner-uid', emailVerified: true };

test('temporary R7 owner gate fails closed for an anonymous request', async () => {
  await assert.rejects(
    () => assertR7PreviewTestOwnerAccess({ headers: {} }, env, {
      authenticate: async () => { throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required'); },
    }),
    (error: unknown) => error instanceof HttpError && error.status === 404,
  );
});

test('temporary R7 owner gate rejects a canonical non-owner and a legacy fallback', async () => {
  for (const actor of [
    { uid: 'owner-uid', authzSource: 'access_grant' as const, roles: ['admin'] },
    { uid: 'owner-uid', authzSource: 'legacy_email' as const, roles: ['owner'] },
  ]) {
    await assert.rejects(
      () => assertR7PreviewTestOwnerAccess({ headers: { authorization: 'Bearer valid' } }, env, {
        authenticate: async () => ownerIdentity,
        authorize: async () => actor,
      }),
      (error: unknown) => error instanceof HttpError && error.status === 403,
    );
  }
});

test('temporary R7 owner gate accepts only a canonical access_grant owner', async () => {
  await assert.doesNotReject(() => assertR7PreviewTestOwnerAccess(
    { headers: { authorization: 'Bearer valid' } }, env,
    {
      authenticate: async () => ownerIdentity,
      authorize: async () => ({ uid: 'owner-uid', authzSource: 'access_grant', roles: ['owner'] }),
    },
  ));
});
