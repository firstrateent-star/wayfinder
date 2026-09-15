import {
  Activity,
  Clock3,
  Flag,
  GitBranch,
  History,
  Link2,
  type LucideIcon
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { JourneyItem, JourneyLayer, JourneyRead } from "@/lib/wayfinder-types";

function formatDay(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date(value));
}

function formatDayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function layerMeta(layer: JourneyLayer): {
  label: string;
  icon: LucideIcon;
  chip: string;
  dot: string;
} {
  if (layer === "REALITY") {
    return {
      label: "Reality",
      icon: Activity,
      chip: "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200",
      dot: "bg-emerald-300"
    };
  }
  if (layer === "DIRECTION") {
    return {
      label: "Direction",
      icon: Flag,
      chip: "border-sky-300/20 bg-sky-300/[0.08] text-sky-200",
      dot: "bg-sky-300"
    };
  }
  if (layer === "EVIDENCE") {
    return {
      label: "Evidence",
      icon: Link2,
      chip: "border-violet-300/20 bg-violet-300/[0.08] text-violet-200",
      dot: "bg-violet-300"
    };
  }
  return {
    label: "Correction",
    icon: History,
    chip: "border-amber-300/20 bg-amber-300/[0.08] text-amber-200",
    dot: "bg-amber-300"
  };
}

function JourneyItemBody({ item }: { item: JourneyItem }) {
  if (item.kind === "PRACTICE_SESSION") {
    const duration = formatDuration(item.payload.duration_seconds);
    return (
      <>
        <p className="font-medium text-slate-100">Practiced {item.payload.practice.name}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-400">
          {duration ? <span>{duration}</span> : null}
          {item.payload.focus ? <span>{item.payload.focus}</span> : null}
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Anchored to when the session is recorded as having occurred, not when it was entered into Wayfinder.
        </p>
      </>
    );
  }

  if (item.kind === "DIRECTION_RECORDED") {
    const kind = item.payload.node.kind.charAt(0).toUpperCase() + item.payload.node.kind.slice(1);
    return (
      <>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{kind} recorded</p>
        <p className="mt-1 font-medium text-slate-100">{item.payload.node.title}</p>
        {item.payload.node.description ? (
          <p className="mt-2 text-sm leading-6 text-slate-400">{item.payload.node.description}</p>
        ) : null}
        {item.payload.current_state && item.payload.current_state.intent_state !== item.payload.node.intent_state_at_recording ? (
          <p className="mt-3 text-xs text-slate-500">
            Current intent state: {item.payload.current_state.intent_state.toLowerCase()}.
          </p>
        ) : null}
      </>
    );
  }

  if (item.kind === "DIRECTION_RELATION_RECORDED") {
    return (
      <>
        <p className="font-medium text-slate-100">Direction relationship recorded</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <span>{item.payload.from.title}</span>
          <GitBranch className="h-4 w-4 text-slate-600" />
          <span className="text-xs uppercase tracking-[0.12em] text-slate-500">{item.payload.relation}</span>
          <span>{item.payload.to.title}</span>
        </div>
      </>
    );
  }

  if (item.kind === "EVIDENCE_RECORDED") {
    const lineageCurrent = item.payload.source.is_current && item.payload.target.is_current;
    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="font-medium text-slate-100">Evidence connected</p>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs ${
              lineageCurrent
                ? "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200"
                : "border-amber-300/20 bg-amber-300/[0.08] text-amber-200"
            }`}
          >
            {lineageCurrent ? "Current exact lineage" : "Historical exact lineage"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {item.payload.source.practice.name}
          {item.payload.source.focus ? ` · ${item.payload.source.focus}` : ""} → {item.payload.target.title}
        </p>
        {item.payload.reason ? <p className="mt-2 text-sm leading-6 text-slate-500">{item.payload.reason}</p> : null}
        {!lineageCurrent ? (
          <p className="mt-3 text-xs leading-5 text-slate-500">
            This relationship remains part of history, but at least one referenced record has since changed.
          </p>
        ) : null}
      </>
    );
  }

  const fields = item.payload.changed_fields.length ? item.payload.changed_fields.join(", ") : "record details";
  return (
    <>
      <p className="font-medium text-slate-100">Practice record corrected</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        {item.payload.after.practice.name} · changed {fields}
      </p>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Version {item.payload.before.version_no} remains in history; version {item.payload.after.version_no} is the newer record.
      </p>
    </>
  );
}

export function JourneyView({ journey }: { journey: JourneyRead }) {
  const counts = journey.items.reduce<Record<JourneyLayer, number>>(
    (acc, item) => {
      acc[item.layer] += 1;
      return acc;
    },
    { REALITY: 0, DIRECTION: 0, EVIDENCE: 0, CORRECTION: 0 }
  );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">How the record arrived here</CardTitle>
          <CardDescription>
            Journey reconstructs selected Wayfinder history without pretending the record is your whole life.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(counts) as JourneyLayer[]).map((layer) => {
              const meta = layerMeta(layer);
              const Icon = meta.icon;
              return (
                <div key={layer} className="rounded-xl border border-white/[0.08] bg-black/[0.14] p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                    <Icon className="h-3.5 w-3.5" /> {meta.label}
                  </div>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">{counts[layer]}</p>
                  <p className="mt-1 text-xs text-slate-600">items in this returned view</p>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-xs leading-5 text-slate-500">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock3 className="h-3.5 w-3.5" /> Two clocks remain distinct
            </div>
            <p className="mt-2">
              Practice activity is placed by occurrence time. Intentions, relationships, evidence, and corrections are placed by record time.
              Their order on one screen does not make those timestamps semantically identical.
            </p>
          </div>
        </CardContent>
      </Card>

      {journey.items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-slate-400">No matching Journey items are stored in this selected period.</p>
            <p className="mt-2 text-xs text-slate-600">This does not mean nothing happened in lived reality.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-7">
          {journey.items.map((item, index) => {
            const previous = index > 0 ? journey.items[index - 1] : null;
            const startsDay = !previous || formatDayKey(previous.timeline_at) !== formatDayKey(item.timeline_at);
            const meta = layerMeta(item.layer);
            const Icon = meta.icon;

            return (
              <div key={item.item_key}>
                {startsDay ? (
                  <div className="mb-3 flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/[0.06]" />
                    <p className="text-xs font-medium uppercase tracking-[0.17em] text-slate-500">{formatDay(item.timeline_at)}</p>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>
                ) : null}

                <div className="grid grid-cols-[28px_1fr] gap-3 sm:grid-cols-[36px_1fr] sm:gap-4">
                  <div className="relative flex justify-center">
                    <div className="absolute bottom-[-28px] top-7 w-px bg-white/[0.07] last:hidden" />
                    <div className={`relative mt-5 h-2.5 w-2.5 rounded-full ${meta.dot} shadow-[0_0_0_5px_rgba(255,255,255,0.025)]`} />
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${meta.chip}`}>
                        <Icon className="h-3.5 w-3.5" /> {meta.label}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <span>{item.time_basis === "OCCURRED" ? "Occurred" : "Recorded"}</span>
                        <span>·</span>
                        <span>{formatTime(item.timeline_at)}</span>
                      </div>
                    </div>
                    <JourneyItemBody item={item} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Card>
        <CardContent className="p-4 text-xs leading-5 text-slate-500 sm:p-5">
          <p>
            Result coverage: {journey.result_coverage.completeness.toLowerCase()} for matching Journey items in this query.
            Lived-reality coverage remains {journey.epistemic_coverage.completeness.toLowerCase()}.
          </p>
          {journey.result_coverage.reason === "RESULT_LIMIT" ? (
            <p className="mt-1 text-amber-200/70">More matching stored items exist outside this returned result limit.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
