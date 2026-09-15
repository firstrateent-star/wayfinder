import { Navigate, Route, Routes } from "react-router-dom";
import { Compass } from "lucide-react";
import { useAuth } from "@/features/auth/AuthProvider";
import { HelmPage } from "@/pages/HelmPage";
import { JourneyPage } from "@/pages/JourneyPage";
import { LoginPage } from "@/pages/LoginPage";

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <Compass className="h-5 w-5 animate-pulse text-emerald-300" />
        Finding your position…
      </div>
    </main>
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

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/helm" replace /> : <LoginPage />} />
      <Route path="/helm" element={session && owner ? <HelmPage /> : <Navigate to="/login" replace />} />
      <Route path="/journey" element={session && owner ? <JourneyPage /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to={session ? "/helm" : "/login"} replace />} />
    </Routes>
  );
}
