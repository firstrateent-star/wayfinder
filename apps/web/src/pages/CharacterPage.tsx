import { useEffect, useMemo, useState } from "react";
import { Compass, LogOut, RefreshCw, Route, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SkillsCharacterView } from "@/features/character/SkillsCharacterView";
import { PracticeOutputsManager } from "@/features/character/PracticeOutputsManager";
import { nextLocalDayScope } from "@/lib/position-api";
import { getWayfinderState, type WayfinderStateRead } from "@/lib/wayfinder-state-api";
import { supabase } from "@/lib/supabase";
import { getPracticeOutputs } from "@/lib/wayfinder-rpc";
import type { PracticeOutputsRead } from "@/lib/wayfinder-types";

export function CharacterPage() {
  const scope = useMemo(() => nextLocalDayScope(), []);
  const [state, setState] = useState<WayfinderStateRead | null>(null);
  const [outputs, setOutputs] = useState<PracticeOutputsRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [nextState, nextOutputs] = await Promise.all([
        getWayfinderState({
          questionMode: "TASK_DRIVEN",
          scheduleScope: scope,
          changeCursor: state?.change_cursor ?? null
        }),
        getPracticeOutputs({ limit: 100 })
      ]);
      setState(nextState);
      setOutputs(nextOutputs);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wayfinder could not assemble your Character.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_25%_-5%,rgba(110,231,183,0.08),transparent_32%),radial-gradient(circle_at_80%_45%,rgba(125,211,252,0.035),transparent_28%)]" />
      <div className="relative mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10">
              <UserRound className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Wayfinder</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Character</h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" asChild>
              <Link to="/helm">
                <Compass className="mr-2 h-4 w-4" /> Helm
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/journey">
                <Route className="mr-2 h-4 w-4" /> Journey
              </Link>
            </Button>
            <Button variant="ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          </div>
        </header>

        <div className="mb-7">
          <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300/60">Who am I becoming?</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
            Your Character, as the evidence currently supports it.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            Nothing here is self-rated at onboarding. These are reconstructable game interpretations over what Wayfinder can actually support.
          </p>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {loading && !state ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-8 text-sm text-slate-500">
            Reading your Character evidence…
          </div>
        ) : null}

        {state ? (
          <div className={loading ? "opacity-70 transition-opacity" : "transition-opacity"}>
            <SkillsCharacterView state={state} onChanged={load} />
            {outputs ? <PracticeOutputsManager read={outputs} onChanged={load} /> : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
