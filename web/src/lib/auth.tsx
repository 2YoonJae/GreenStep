import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { OrgSignupInput, YouthSignupInput } from '../api/types';
import type { Organization, Session, User } from '../data/types';

interface AuthState {
  session: Session | null;
  ready: boolean;
  loginYouth(email: string, password: string): Promise<Session>;
  loginOrg(email: string, password: string): Promise<Session>;
  signupYouth(input: YouthSignupInput): Promise<Session>;
  signupOrg(input: OrgSignupInput): Promise<Session>;
  logout(): Promise<void>;
  setOrg(org: Organization): void;
  setUser(user: User): void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.auth
      .restore()
      .then(setSession)
      .finally(() => setReady(true));
  }, []);

  const wrap = useCallback(
    <A extends unknown[]>(fn: (...a: A) => Promise<Session>) =>
      async (...a: A) => {
        const s = await fn(...a);
        setSession(s);
        return s;
      },
    [],
  );

  const value = useMemo<AuthState>(
    () => ({
      session,
      ready,
      loginYouth: wrap(api.auth.loginYouth),
      loginOrg: wrap(api.auth.loginOrg),
      signupYouth: wrap(api.auth.signupYouth),
      signupOrg: wrap(api.auth.signupOrg),
      logout: async () => {
        await api.auth.logout();
        setSession(null);
      },
      setOrg: (org) => setSession((s) => (s ? { ...s, org } : s)),
      setUser: (user) => setSession((s) => (s ? { ...s, user } : s)),
    }),
    [session, ready, wrap],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider 안에서 사용하세요');
  return v;
}
