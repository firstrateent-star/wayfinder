import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ensureOwner } from "@/lib/wayfinder-rpc";
import type { OwnerBootstrap } from "@/lib/wayfinder-types";

type AuthState = {
  session: Session | null;
  owner: OwnerBootstrap | null;
  loading: boolean;
  error: string | null;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [owner, setOwner] = useState<OwnerBootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(nextSession: Session | null) {
      if (cancelled) return;
      setSession(nextSession);
      setOwner(null);
      setError(null);

      if (!nextSession) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
        const nextOwner = await ensureOwner(timezone);
        if (!cancelled) setOwner(nextOwner);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Owner bootstrap failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }
      void bootstrap(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void bootstrap(nextSession);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ session, owner, loading, error }), [session, owner, loading, error]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}
