import type { VercelRequest, VercelResponse } from '@vercel/node';

import type { Permission } from '../../shared/authz.js';
import { authenticate, type AuthenticatedIdentity } from './authenticate.js';
import { authorize, type AuthorizedActor } from './authorize.js';
import { toHttpError } from './http-errors.js';

type ProtectedHandler = (
  req: VercelRequest,
  res: VercelResponse,
  actor: AuthorizedActor,
) => Promise<unknown> | unknown;

interface RequirePermissionDependencies {
  authenticate(req: VercelRequest): Promise<AuthenticatedIdentity>;
  authorize(
    identity: AuthenticatedIdentity,
    permission: Permission | readonly Permission[],
  ): Promise<AuthorizedActor>;
}

const defaultDependencies: RequirePermissionDependencies = {
  authenticate,
  authorize,
};

export function requirePermission(
  permission: Permission | readonly Permission[],
  handler: ProtectedHandler,
  dependencies: RequirePermissionDependencies = defaultDependencies,
) {
  return async function protectedHandler(
    req: VercelRequest,
    res: VercelResponse,
  ): Promise<void> {
    try {
      const identity = await dependencies.authenticate(req);
      const actor = await dependencies.authorize(identity, permission);
      await handler(req, res, actor);
    } catch (error) {
      const httpError = toHttpError(error);
      res.status(httpError.status).json({
        error: httpError.code,
        message: httpError.message,
      });
    }
  };
}
