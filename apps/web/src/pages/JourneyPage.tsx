import { useCallback, useEffect, useState } from "react";
import { Compass, LogOut, RefreshCw, Route } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { JourneyView } from "@/features/journey/JourneyView";
import { supabase } from "@/lib/supabase";
import { getJourney } from "@/lib/wayfinder-rpc";
import type { JourneyRead } from "@/lib/wayfinder-types";

const RANGE_OPTIONS = [7, 30, 90] as const;
type RangeDays = (typeof RANGE_OPTIONS)[number];

function scopeForDays(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function JourneyPage() {
  const [days, setDays] = useState<RangeDays>(30);
  const [journey, setJourney] = useState<JourneyRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const scope = scopeForDays(days);
      const next = await getJourney({ ...scope, limit: 100 });
      setJourney(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Journey could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,0.06),transparent_28%),radial-gradient(circle_at_80%_25%,rgba(110,231,183,0.05),transparent_32%)]" />
      <div className="relative mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-300/10">
              <Route className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Wayfinder</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Journey</h1>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" asChild>
              <Link to="/helm">
                <Compass className="mr-2 h-4 w-4" /> Helm
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

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-200">Your recent path</p>
            <p className="mt-1 text-sm text-slate-500">A simple view of what you've recorded over time.</p>
          </div>
          <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-black/[0.18] p-1">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setDays(option)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === option ? "bg-white/[0.1] text-slate-100" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {option === 7 ? "Week" : option === 30 ? "Month" : "3 months"}
              </button>
            ))}
          </div>
        </div>

        {error ? <div className="mb-6 rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-200">{error}</div> : null}

        {loading && !journey ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-sm text-slate-500">Looking back…</div>
        ) : null}

        {journey ? (
          <div className={loading ? "opacity-70 transition-opacity" : "transition-opacity"}>
            <JourneyView journey={journey} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
