import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import {
  fetchAuthSession,
  hasSessionPermission,
  type AuthSession,
} from '../lib/auth-session';
import type { Permission } from '../../shared/authz';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authorizationSession: AuthSession | null;
  authorizationLoading: boolean;
  authorizationError: string | null;
  hasPermission: (permission: Permission) => boolean;
  refreshAuthorization: (forceTokenRefresh?: boolean) => Promise<void>;
  signInWithGoogle: () => Promise<any>;
  signInWithEmail: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorizationSession, setAuthorizationSession] =
    useState<AuthSession | null>(null);
  const [authorizationLoading, setAuthorizationLoading] = useState(false);
  const [authorizationError, setAuthorizationError] = useState<string | null>(null);
  const authorizationRequestId = useRef(0);

  const loadAuthorization = useCallback(
    async (authenticatedUser: User, forceTokenRefresh = false) => {
      const requestId = ++authorizationRequestId.current;
      setAuthorizationLoading(true);
      setAuthorizationError(null);
      try {
        const session = await fetchAuthSession(
          authenticatedUser,
          fetch,
          forceTokenRefresh,
        );
        if (requestId === authorizationRequestId.current) {
          setAuthorizationSession(session);
        }
      } catch (error) {
        if (requestId === authorizationRequestId.current) {
          setAuthorizationSession(null);
          setAuthorizationError(
            error instanceof Error ? error.message : 'Authorization session unavailable',
          );
        }
      } finally {
        if (requestId === authorizationRequestId.current) {
          setAuthorizationLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (authenticatedUser) => {
      if (cancelled) return;
      setUser(authenticatedUser);

      if (!authenticatedUser) {
        authorizationRequestId.current += 1;
        setAuthorizationSession(null);
        setAuthorizationError(null);
        setAuthorizationLoading(false);
        setLoading(false);
        return;
      }

      await loadAuthorization(authenticatedUser);
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadAuthorization]);

  const refreshAuthorization = async (forceTokenRefresh = true) => {
    if (!user) {
      setAuthorizationSession(null);
      return;
    }
    await loadAuthorization(user, forceTokenRefresh);
  };

  const hasPermission = (permission: Permission) =>
    Boolean(
      user &&
        authorizationSession?.uid === user.uid &&
        hasSessionPermission(authorizationSession, permission),
    );

  const signInWithGoogle = async () => {
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Error signing in with Google', error);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing in with email', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      authorizationRequestId.current += 1;
      setAuthorizationSession(null);
      setAuthorizationError(null);
    } catch (error) {
      console.error('Error signing out', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authorizationSession,
        authorizationLoading,
        authorizationError,
        hasPermission,
        refreshAuthorization,
        signInWithGoogle,
        signInWithEmail,
        signOut,
      }}
    >
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
