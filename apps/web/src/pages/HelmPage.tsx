import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Compass, LogOut, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavigatorChat } from "@/features/navigator/NavigatorChat";
import { nextLocalDayScope } from "@/lib/position-api";
import type { PositionScheduleAllocation } from "@/lib/position-api";
import { getWayfinderState } from "@/lib/wayfinder-state-api";
import type { WayfinderStateRead } from "@/lib/wayfinder-state-api";
import { supabase } from "@/lib/supabase";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date(value));
}

function formatAllocationTime(item: PositionScheduleAllocation) {
  const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  if (item.startsAt && item.endsAt) return `${formatter.format(new Date(item.startsAt))}–${formatter.format(new Date(item.endsAt))}`;
  if (item.windowStartsAt && item.windowEndsAt) return `${formatter.format(new Date(item.windowStartsAt))}–${formatter.format(new Date(item.windowEndsAt))} window`;
  if (item.dueAt) return `Due ${formatter.format(new Date(item.dueAt))}`;
  return "Planned";
}

export function HelmPage() {
  const scope = useMemo(() => nextLocalDayScope(), []);
  const [state, setState] = useState<WayfinderStateRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshState() {
    setError(null);
    try {
      const next = await getWayfinderState({
        questionMode: "TASK_DRIVEN",
        scheduleScope: scope,
        changeCursor: state?.change_cursor ?? null
      });
      setState(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wayfinder could not recompute your current state.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshState();
  }, []);

  const position = state?.position ?? null;
  const displayName = position?.person?.display_name ?? "Player";
  const tomorrowLabel = position ? formatDay(position.schedule.scope.from) : formatDay(scope.from);
  const currentFocus = position?.direction.current_focus ?? null;
  const primaryInsight = state?.helm.primary_insight ?? null;
  const focusActions = state?.helm.focus_branch.actions ?? [];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-12%,rgba(110,231,183,0.09),transparent_34%),radial-gradient(circle_at_82%_70%,rgba(148,163,184,0.035),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10">
              <Compass className="h-5 w-5 text-emerald-300" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Wayfinder</p>
              <h1 className="text-xl font-semibold tracking-tight text-slate-100">Helm</h1>
            </div>
          </div>

          <Button variant="ghost" onClick={() => void supabase.auth.signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </header>

        <section className="mx-auto w-full max-w-3xl py-10 sm:py-14">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-400">
              <Compass className="h-5 w-5 animate-pulse text-emerald-300" />
              Finding your position…
            </div>
          ) : null}

          {!loading && error && !state ? (
            <div className="mx-auto max-w-md rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6 text-center">
              <p className="text-sm font-medium text-rose-200">Wayfinder could not assemble your position.</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{error}</p>
              <Button variant="secondary" className="mt-5" onClick={() => void refreshState()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          ) : null}

          {!loading && state && position ? (
            <>
              <div className="mb-7">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300/60">Where am I?</p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl">
                  {greeting()}, {displayName}.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
                  Talk to Navigator naturally. It should understand first, route what belongs somewhere, ask for missing details when they matter, and leave the rest alone.
                </p>
              </div>

              <div className="mb-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 sm:px-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-2.5">
                    <Target className="mt-0.5 h-4 w-4 text-emerald-300/60" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-slate-600">Current direction</p>
                      <p className="mt-1 truncate text-sm text-slate-300">{currentFocus?.title ?? "Not established yet"}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 sm:justify-end">
                    <CalendarDays className="mt-0.5 h-4 w-4 text-emerald-300/60" />
                    <div className="min-w-0 sm:text-right">
                      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-slate-600">{tomorrowLabel}</p>
                      <p className="mt-1 text-sm text-slate-300">
                        {position.schedule.recorded_allocation_count > 0
                          ? `${position.schedule.recorded_allocation_count} planned item${position.schedule.recorded_allocation_count === 1 ? "" : "s"}`
                          : "Schedule coverage unknown"}
                      </p>
                    </div>
                  </div>
                </div>

                {position.schedule.allocations.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.05] pt-3">
                    {position.schedule.allocations.slice(0, 4).map((item) => (
                      <span key={item.id} className="rounded-full border border-white/[0.06] bg-black/10 px-3 py-1.5 text-xs text-slate-500">
                        <span className="text-slate-400">{item.label}</span> · {formatAllocationTime(item)}
                      </span>
                    ))}
                  </div>
                ) : null}

                {primaryInsight ? <p className="mt-3 border-t border-white/[0.05] pt-3 text-xs leading-5 text-slate-500">{primaryInsight.headline}</p> : null}
              </div>

              {focusActions.length > 0 ? (
                <div className="mb-5 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.025] px-4 py-3.5 sm:px-5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-emerald-300/50">
                    Supporting {focusActions.length === 1 ? "action" : "actions"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {focusActions.slice(0, 4).map((action) => (
                      <span key={action.id} className="rounded-full border border-emerald-300/10 bg-black/10 px-3 py-1.5 text-xs text-slate-300">
                        {action.title}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-slate-600">
                    Shown because these Actions support the current Direction through canonical Direction edges—not because Wayfinder inferred a priority.
                  </p>
                </div>
              ) : null}

              <NavigatorChat displayName={displayName} onCanonicalChange={refreshState} />

              {error ? <p className="mt-4 px-1 text-sm text-rose-300">{error}</p> : null}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
