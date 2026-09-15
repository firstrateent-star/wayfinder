import { ArrowRight, CircleDot, Footprints, History, Route } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvidenceState, HelmRead } from "@/lib/wayfinder-types";

function evidenceLabel(state: EvidenceState) {
  if (state === "CURRENT_EVIDENCE_PRESENT") return "Current recorded evidence";
  if (state === "STALE_RECORDED_EVIDENCE_ONLY") return "Historical evidence; underlying record changed";
  return "No recorded evidence yet";
}

function evidenceClass(state: EvidenceState) {
  if (state === "CURRENT_EVIDENCE_PRESENT") return "border-emerald-300/20 bg-emerald-300/8 text-emerald-200";
  if (state === "STALE_RECORDED_EVIDENCE_ONLY") return "border-amber-300/20 bg-amber-300/8 text-amber-200";
  return "border-white/10 bg-white/5 text-slate-400";
}

function bearingCopy(state: HelmRead["bearing"]["state"]) {
  if (state === "RECORDED_EVIDENCE_OF_MOVEMENT") return "Wayfinder has current recorded evidence of movement toward at least one active Action.";
  if (state === "NO_ACTIVE_ACTIONS") return "No active Actions are currently recorded in Wayfinder.";
  return "Wayfinder has active Actions, but no current recorded evidence of movement toward them yet.";
}

function formatMoment(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function HelmView({ helm }: { helm: HelmRead }) {
  const activeDirection = helm.direction.nodes.filter(
    (node) => node.intent_state === "ACTIVE" && ["direction", "outcome", "quest"].includes(node.kind)
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[1.3fr_0.9fr]">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/80">
              <Route className="h-4 w-4" /> Bearing
            </div>
            <CardTitle className="text-xl">Where the record points right now</CardTitle>
            <CardDescription>{bearingCopy(helm.bearing.state)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {helm.bearing.actions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                No active Action records to display.
              </div>
            ) : (
              helm.bearing.actions.map((action) => (
                <div key={action.id} className="rounded-xl border border-white/8 bg-black/15 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-100">{action.title}</p>
                      {action.supports_targets.length > 0 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>Supports</span>
                          <ArrowRight className="h-3 w-3" />
                          {action.supports_targets.map((target) => (
                            <span key={target.id} className="rounded-full bg-white/5 px-2 py-1 text-slate-300">
                              {target.title}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs ${evidenceClass(action.evidence_state)}`}>
                      {evidenceLabel(action.evidence_state)}
                    </span>
                  </div>
                </div>
              ))
            )}
            <p className="text-xs leading-5 text-slate-500">
              Bearing is descriptive, not a progress score. Missing recorded evidence is not proof that no real movement occurred.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              <CircleDot className="h-4 w-4" /> Direction
            </div>
            <CardTitle>What currently matters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {activeDirection.length === 0 ? (
              <p className="text-sm text-slate-500">No active Direction, Outcome, or Quest records yet.</p>
            ) : (
              activeDirection.map((node) => (
                <div key={node.id} className="rounded-xl border border-white/8 bg-black/15 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{node.kind}</p>
                  <p className="mt-2 font-medium text-slate-100">{node.title}</p>
                  {node.description ? <p className="mt-2 text-sm leading-6 text-slate-400">{node.description}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
            <Footprints className="h-4 w-4" /> Recent Practice
          </div>
          <CardTitle>What Wayfinder has recorded</CardTitle>
          <CardDescription>
            {helm.practice.sessions.length === 0
              ? "No matching PracticeSession records are stored in this selected period."
              : `${helm.practice.returned_count} session record${helm.practice.returned_count === 1 ? "" : "s"} shown.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {helm.practice.sessions.map((session) => (
            <div key={session.id} className="rounded-xl border border-white/8 bg-black/15 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-slate-100">{session.practice.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatMoment(session.occurrence.from)}</p>
                </div>
                {session.duration_seconds ? (
                  <span className="text-sm text-slate-300">{Math.round(session.duration_seconds / 60)}m</span>
                ) : null}
              </div>
              {session.focus ? <p className="mt-3 text-sm leading-6 text-slate-400">{session.focus}</p> : null}
            </div>
          ))}

          <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.025] p-4 text-xs leading-5 text-slate-500">
            <div className="flex items-center gap-2 text-slate-400">
              <History className="h-3.5 w-3.5" /> Coverage
            </div>
            <p className="mt-2">
              Result coverage: {helm.practice.result_coverage.completeness.toLowerCase()} for stored records in this query.
              Lived-reality coverage remains {helm.practice.epistemic_coverage.completeness.toLowerCase()}.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
