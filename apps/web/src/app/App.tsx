import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Compass } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { CharacterCreationPage } from "@/pages/CharacterCreationPage";
import { HelmPage } from "@/pages/HelmPage";
import { LoginPage } from "@/pages/LoginPage";
import { getCurrentPerson } from "@/lib/wayfinder-rpc";

function LoadingScreen({ label = "Finding your position…" }: { label?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <Compass className="h-5 w-5 animate-pulse text-emerald-300" />
        {label}
      </div>
    </main>
  );
}

function PlayerRoutes() {
  const navigate = useNavigate();
  const [checkingPerson, setCheckingPerson] = useState(true);
  const [hasPerson, setHasPerson] = useState<boolean | null>(null);
  const [personError, setPersonError] = useState<string | null>(null);

  async function refreshPerson() {
    setCheckingPerson(true);
    setPersonError(null);
    try {
      const current = await getCurrentPerson();
      setHasPerson(Boolean(current.person));
    } catch (cause) {
      setPersonError(cause instanceof Error ? cause.message : "Wayfinder could not read your character foundation.");
      setHasPerson(null);
    } finally {
      setCheckingPerson(false);
    }
  }

  useEffect(() => {
    void refreshPerson();
  }, []);

  if (checkingPerson) return <LoadingScreen label="Checking your character…" />;

  if (personError || hasPerson == null) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="max-w-md rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6">
          <p className="text-sm font-medium text-rose-200">Wayfinder could not resolve your character foundation.</p>
          <p className="mt-2 text-sm text-slate-400">{personError ?? "Unknown player-state error."}</p>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route
        path="/create-character"
        element={
          hasPerson ? (
            <Navigate to="/helm" replace />
          ) : (
            <CharacterCreationPage
              onCreated={() => {
                setHasPerson(true);
                navigate("/helm", { replace: true });
              }}
            />
          )
        }
      />
      <Route path="/helm" element={hasPerson ? <HelmPage /> : <Navigate to="/create-character" replace />} />
      <Route path="/journey" element={<Navigate to={hasPerson ? "/helm" : "/create-character"} replace />} />
      <Route path="*" element={<Navigate to={hasPerson ? "/helm" : "/create-character"} replace />} />
    </Routes>
  );
}

export function App() {
  const { session, owner, loading, error } = useAuth();

  if (loading) return <LoadingScreen />;

  if (error && session && !owner) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-6 text-foreground">
        <div className="max-w-md rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6">
          <p className="text-sm font-medium text-rose-200">Wayfinder could not establish your owner scope.</p>
          <p className="mt-2 text-sm text-slate-400">{error}</p>
        </div>
      </main>
    );
  }

  if (!session || !owner) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <PlayerRoutes />;
}
