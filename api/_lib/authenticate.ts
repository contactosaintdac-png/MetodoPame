import type { DecodedIdToken } from 'firebase-admin/auth';

import { getAdminAuth } from './firebase-admin.js';
import { HttpError } from './http-errors.js';

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface TokenVerifier {
  verifyIdToken(token: string, checkRevoked?: boolean): Promise<DecodedIdToken | { uid: string; [key: string]: unknown }>;
}

export interface AuthenticatedIdentity {
  uid: string;
  email?: string;
  emailVerified: boolean;
  issuedAt?: number;
  authTime?: number;
}

function readAuthorizationHeader(req: RequestLike): string | undefined {
  const value = req.headers?.authorization;
  return Array.isArray(value) ? value[0] : value;
}

export async function authenticate(
  req: RequestLike,
  verifier?: TokenVerifier,
): Promise<AuthenticatedIdentity> {
  const authorization = readAuthorizationHeader(req);
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required');
  }

  try {
    const decoded = await (verifier ?? getAdminAuth()).verifyIdToken(token, true);
    return {
      uid: decoded.uid,
      ...(typeof decoded.email === 'string' ? { email: decoded.email } : {}),
      emailVerified: decoded.email_verified === true,
      ...(typeof decoded.iat === 'number' ? { issuedAt: decoded.iat } : {}),
      ...(typeof decoded.auth_time === 'number' ? { authTime: decoded.auth_time } : {}),
    };
  } catch {
    throw new HttpError(401, 'INVALID_TOKEN', 'Invalid or expired authentication token');
  }
}
