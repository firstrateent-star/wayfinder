import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Compass, LogOut, RefreshCw, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DiscoverySession } from "@/features/discovery/DiscoverySession";
import { getInitialPosition, nextLocalDayScope } from "@/lib/position-api";
import type { InitialPositionRead, PositionQuestionOpportunity } from "@/lib/position-api";
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

function formatAllocationTime(position: InitialPositionRead) {
  const item = position.schedule.next_recorded_allocation;
  if (!item) return null;

  if (item.startsAt && item.endsAt) {
    const formatter = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
    return `${formatter.format(new Date(item.startsAt))}–${formatter.format(new Date(item.endsAt))}`;
  }
  if (item.windowStartsAt && item.windowEndsAt) return "Inside a planned window";
  if (item.dueAt) return `Due ${new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(item.dueAt))}`;
  return "Planned";
}

function bodyBaselineLabel(state: InitialPositionRead["foundation"]["body_baseline"]) {
  if (state === "ESTABLISHED") return "Baseline established";
  if (state === "PARTIAL") return "Partial baseline";
  return "Not established yet";
}

export function HelmPage() {
  const scope = useMemo(() => nextLocalDayScope(), []);
  const [position, setPosition] = useState<InitialPositionRead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryQuestion, setDiscoveryQuestion] = useState<PositionQuestionOpportunity | null>(null);

  async function refreshPosition() {
    setError(null);
    try {
      const next = await getInitialPosition({ questionMode: "TASK_DRIVEN", scheduleScope: scope });
      setPosition(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wayfinder could not assemble your position.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshPosition();
  }, []);

  async function startDiscovery() {
    setDiscoveryLoading(true);
    setError(null);
    try {
      const discoveryPosition = await getInitialPosition({ questionMode: "DISCOVERY_SESSION", scheduleScope: scope });
      setPosition(discoveryPosition);
      setDiscoveryQuestion(discoveryPosition.question_opportunities[0] ?? null);
      setDiscoveryOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Navigator could not prepare a discovery question.");
    } finally {
      setDiscoveryLoading(false);
    }
  }

  const displayName = position?.person?.display_name ?? "Player";
  const nextAllocation = position?.schedule.next_recorded_allocation ?? null;
  const nextAllocationTime = position ? formatAllocationTime(position) : null;
  const tomorrowLabel = position ? formatDay(position.schedule.scope.from) : formatDay(scope.from);

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

        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-14 sm:py-20">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-400">
              <Compass className="h-5 w-5 animate-pulse text-emerald-300" />
              Finding your position…
            </div>
          ) : null}

          {!loading && error && !position ? (
            <div className="mx-auto max-w-md rounded-2xl border border-rose-400/20 bg-rose-400/5 p-6 text-center">
              <p className="text-sm font-medium text-rose-200">Wayfinder could not assemble your position.</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">{error}</p>
              <Button variant="secondary" className="mt-5" onClick={() => void refreshPosition()}>
                <RefreshCw className="mr-2 h-4 w-4" /> Retry
              </Button>
            </div>
          ) : null}

          {!loading && position ? (
            <>
              <div className="mb-9">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300/60">Where am I?</p>
                <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl">
                  {greeting()}, {displayName}.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">
                  Your starting character is established. Wayfinder can now begin learning the structure around you without turning your life into a setup checklist.
                </p>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/[0.07] bg-white/[0.025] p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <UserRound className="h-4 w-4 text-emerald-300/80" />
                    Starting position
                  </div>

                  <div className="mt-5 divide-y divide-white/[0.06]">
                    <div className="flex items-center justify-between gap-6 py-3 first:pt-0">
                      <div>
                        <p className="text-sm text-slate-300">Origin</p>
                        <p className="mt-1 text-xs text-slate-500">Your character foundation</p>
                      </div>
                      <p className="text-sm text-slate-400">{position.foundation.origin_established ? "Established" : "Incomplete"}</p>
                    </div>

                    <div className="flex items-center justify-between gap-6 py-3">
                      <div>
                        <p className="text-sm text-slate-300">Body</p>
                        <p className="mt-1 text-xs text-slate-500">Initial observations only</p>
                      </div>
                      <p className="text-sm text-slate-400">{bodyBaselineLabel(position.foundation.body_baseline)}</p>
                    </div>

                    <div className="flex items-start justify-between gap-6 py-3 last:pb-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-500" />
                          <p className="text-sm text-slate-300">{tomorrowLabel}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {nextAllocation ? "Known planned time" : "Schedule coverage is still unknown"}
                        </p>
                      </div>
                      <div className="max-w-[48%] text-right">
                        {nextAllocation ? (
                          <>
                            <p className="text-sm text-slate-300">{nextAllocation.label}</p>
                            {nextAllocationTime ? <p className="mt-1 text-xs text-slate-500">{nextAllocationTime}</p> : null}
                          </>
                        ) : (
                          <p className="text-sm text-slate-500">Nothing recorded yet</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {!nextAllocation ? (
                    <p className="mt-4 text-xs leading-5 text-slate-600">Nothing recorded does not mean the day is free.</p>
                  ) : null}
                </div>

                {discoveryOpen ? (
                  <DiscoverySession
                    question={discoveryQuestion}
                    knownScheduleCount={position.schedule.recorded_allocation_count}
                    scope={scope}
                    onSaved={refreshPosition}
                    onClose={() => setDiscoveryOpen(false)}
                  />
                ) : (
                  <div className="rounded-3xl border border-emerald-300/10 bg-emerald-300/[0.025] p-5 sm:p-6">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
                      <Sparkles className="h-4 w-4 text-emerald-300" />
                      Navigator
                    </div>
                    <p className="mt-3 text-base leading-7 text-slate-300">
                      {position.schedule.recorded_allocation_count === 0
                        ? "I know who I’m navigating for. I don’t know enough about how your time is structured yet."
                        : `I know about ${position.schedule.recorded_allocation_count} planned commitment${position.schedule.recorded_allocation_count === 1 ? "" : "s"} tomorrow, but I still won't assume the rest of the day is free.`}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Discovery asks one high-value question at a time. Answers only become canonical when they have a legitimate domain and you authorize the write.
                    </p>
                    <Button className="mt-5" disabled={discoveryLoading} onClick={() => void startDiscovery()}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      {discoveryLoading ? "Choosing the next question…" : position.schedule.recorded_allocation_count === 0 ? "Start discovering my world" : "Continue discovery"}
                    </Button>
                  </div>
                )}

                {error ? <p className="px-1 text-sm text-rose-300">{error}</p> : null}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
