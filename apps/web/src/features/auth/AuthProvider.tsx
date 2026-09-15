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

function clearAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("code");
  url.searchParams.delete("error");
  url.searchParams.delete("error_code");
  url.searchParams.delete("error_description");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}`);
}

async function recoverSessionFromUrl() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  const errorDescription = hash.get("error_description") ?? url.searchParams.get("error_description");

  if (errorDescription) {
    clearAuthParamsFromUrl();
    throw new Error(decodeURIComponent(errorDescription.replace(/\+/g, " ")));
  }

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    clearAuthParamsFromUrl();
    if (error) throw error;
    return data.session;
  }

  const code = url.searchParams.get("code");
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    clearAuthParamsFromUrl();
    if (error) throw error;
    return data.session;
  }

  return null;
}

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

    async function initialize() {
      try {
        const callbackSession = await recoverSessionFromUrl();
        if (callbackSession) {
          await bootstrap(callbackSession);
          return;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        await bootstrap(data.session);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Authentication failed.");
          setLoading(false);
        }
      }
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void bootstrap(nextSession);
    });

    void initialize();

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
