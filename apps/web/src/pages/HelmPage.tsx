import { useCallback, useEffect, useState } from "react";
import { Compass, LogOut, RefreshCw, Route, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { QuickDirectionCapture } from "@/features/direction/QuickDirectionCapture";
import { EvidenceLinkCapture } from "@/features/evidence/EvidenceLinkCapture";
import { HelmView } from "@/features/helm/HelmView";
import { PracticeCorrection } from "@/features/practice/PracticeCorrection";
import { QuickPracticeCapture } from "@/features/practice/QuickPracticeCapture";
import { supabase } from "@/lib/supabase";
import { getHelm } from "@/lib/wayfinder-rpc";
import type { HelmRead } from "@/lib/wayfinder-types";

function defaultScope() {
  const to = new Date();
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function HelmPage() {
  const [helm, setHelm] = useState<HelmRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState(defaultScope);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getHelm({ ...scope, sessionLimit: 20 });
      setHelm(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wayfinder could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshAfterCapture() {
    const nextScope = defaultScope();
    setScope(nextScope);
    const next = await getHelm({ ...nextScope, sessionLimit: 20 });
    setHelm(next);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(110,231,183,0.08),transparent_28%),radial-gradient(circle_at_100%_40%,rgba(148,163,184,0.05),transparent_30%)]" />
      <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10">
              <Compass className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Wayfinder</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Helm</h1>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" asChild>
              <Link to="/journey">
                <Route className="mr-2 h-4 w-4" /> Journey
              </Link>
            </Button>
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </header>

        {error ? <div className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">{error}</div> : null}

        {loading && !helm ? (
          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-8 text-sm text-slate-500">Finding your current position…</div>
        ) : null}

        {helm ? (
          <div className="space-y-7">
            <HelmView helm={helm} />

            <section>
              <div className="mb-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Add to Wayfinder</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-100">Keep the picture current</h2>
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                <QuickPracticeCapture helm={helm} onSaved={refreshAfterCapture} />
                <QuickDirectionCapture helm={helm} onSaved={refreshAfterCapture} />
              </div>
            </section>

            <details className="group rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm text-slate-400 transition-colors hover:text-slate-200">
                <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> Advanced tools</span>
                <span className="text-xs text-slate-600">Optional</span>
              </summary>
              <div className="border-t border-white/[0.06] p-5">
                <div className="grid gap-5 xl:grid-cols-2">
                  <EvidenceLinkCapture helm={helm} onSaved={refreshAfterCapture} />
                  <PracticeCorrection helm={helm} onSaved={refreshAfterCapture} />
                </div>
              </div>
            </details>
          </div>
        ) : null}
      </div>
    </main>
  );
}
