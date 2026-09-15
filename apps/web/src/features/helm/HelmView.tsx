import { ArrowRight, CircleDot, Footprints, Route } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvidenceState, HelmRead } from "@/lib/wayfinder-types";

function evidenceLabel(state: EvidenceState) {
  if (state === "CURRENT_EVIDENCE_PRESENT") return "Movement recorded";
  if (state === "STALE_RECORDED_EVIDENCE_ONLY") return "Needs reconnecting";
  return "No activity linked";
}

function evidenceClass(state: EvidenceState) {
  if (state === "CURRENT_EVIDENCE_PRESENT") return "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200";
  if (state === "STALE_RECORDED_EVIDENCE_ONLY") return "border-amber-300/20 bg-amber-300/[0.08] text-amber-200";
  return "border-white/10 bg-white/5 text-slate-400";
}

function bearingCopy(state: HelmRead["bearing"]["state"]) {
  if (state === "RECORDED_EVIDENCE_OF_MOVEMENT") return "You have activity connected to something you're moving toward.";
  if (state === "NO_ACTIVE_ACTIONS") return "Nothing is asking for your attention yet.";
  return "You have something you're moving toward, but no activity has been connected to it yet.";
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
              <Route className="h-4 w-4" /> Now
            </div>
            <CardTitle className="text-xl">Where you're headed</CardTitle>
            <CardDescription>{bearingCopy(helm.bearing.state)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {helm.bearing.actions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                Add a next action when something starts to matter.
              </div>
            ) : (
              helm.bearing.actions.map((action) => (
                <div key={action.id} className="rounded-xl border border-white/[0.08] bg-black/[0.15] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-100">{action.title}</p>
                      {action.supports_targets.length > 0 ? (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>Leads toward</span>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
              <CircleDot className="h-4 w-4" /> What matters
            </div>
            <CardTitle>Your bigger direction</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {activeDirection.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing bigger has been added yet.</p>
            ) : (
              activeDirection.map((node) => (
                <div key={node.id} className="rounded-xl border border-white/[0.08] bg-black/[0.15] p-4">
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
            <Footprints className="h-4 w-4" /> Recently
          </div>
          <CardTitle>What you've been doing</CardTitle>
          <CardDescription>
            {helm.practice.sessions.length === 0
              ? "Nothing has been logged here yet."
              : `${helm.practice.returned_count} recent activit${helm.practice.returned_count === 1 ? "y" : "ies"}.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {helm.practice.sessions.map((session) => (
            <div key={session.id} className="rounded-xl border border-white/[0.08] bg-black/[0.15] p-4">
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
          <p className="pt-1 text-xs leading-5 text-slate-600">Wayfinder only knows what you choose to record.</p>
        </CardContent>
      </Card>
    </div>
  );
}
