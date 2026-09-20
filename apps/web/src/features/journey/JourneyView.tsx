import { Activity, ExternalLink, FileCheck2, Flag, GitBranch, History, Link2, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
      label: "Did",
      icon: Activity,
      chip: "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200",
      dot: "bg-emerald-300"
    };
  }
  if (layer === "RESULT") {
    return {
      label: "Made",
      icon: FileCheck2,
      chip: "border-fuchsia-300/20 bg-fuchsia-300/[0.08] text-fuchsia-200",
      dot: "bg-fuchsia-300"
    };
  }
  if (layer === "DIRECTION") {
    return {
      label: "Chose",
      icon: Flag,
      chip: "border-sky-300/20 bg-sky-300/[0.08] text-sky-200",
      dot: "bg-sky-300"
    };
  }
  if (layer === "EVIDENCE") {
    return {
      label: "Connected",
      icon: Link2,
      chip: "border-violet-300/20 bg-violet-300/[0.08] text-violet-200",
      dot: "bg-violet-300"
    };
  }
  return {
    label: "Updated",
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
        <p className="font-medium text-slate-100">{item.payload.practice.name}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-400">
          {duration ? <span>{duration}</span> : null}
          {item.payload.focus ? <span>{item.payload.focus}</span> : null}
        </div>
      </>
    );
  }

  if (item.kind === "PRACTICE_OUTPUT_RECORDED") {
    const changed = item.payload.current_state &&
      item.payload.current_state.version !== item.payload.primary_ref.version;
    return (
      <>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-fuchsia-300/55">
              {item.payload.output.practice.name}
            </p>
            <p className="mt-1 font-medium text-slate-100">{item.payload.output.title}</p>
          </div>
          {changed ? (
            <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2.5 py-1 text-xs text-amber-200">
              Record later changed
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Recorded a completed output from a Practice session.
        </p>
        {item.payload.output.external_url ? (
          <a
            href={item.payload.output.external_url}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-fuchsia-200/70 hover:text-fuchsia-200"
          >
            Evidence link <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </>
    );
  }

  if (item.kind === "DIRECTION_RECORDED") {
    const kind = item.payload.node.kind.charAt(0).toUpperCase() + item.payload.node.kind.slice(1);
    return (
      <>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{kind}</p>
        <p className="mt-1 font-medium text-slate-100">{item.payload.node.title}</p>
        {item.payload.node.description ? <p className="mt-2 text-sm leading-6 text-slate-400">{item.payload.node.description}</p> : null}
      </>
    );
  }

  if (item.kind === "DIRECTION_RELATION_RECORDED") {
    return (
      <>
        <p className="font-medium text-slate-100">Connected two things that matter</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <span>{item.payload.from.title}</span>
          <GitBranch className="h-4 w-4 text-slate-600" />
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
          <p className="font-medium text-slate-100">Linked activity to a direction</p>
          <span className={`rounded-full border px-2.5 py-1 text-xs ${lineageCurrent ? "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200" : "border-amber-300/20 bg-amber-300/[0.08] text-amber-200"}`}>
            {lineageCurrent ? "Still current" : "Record later changed"}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {item.payload.source.practice.name}
          {item.payload.source.focus ? ` · ${item.payload.source.focus}` : ""} → {item.payload.target.title}
        </p>
        {item.payload.reason ? <p className="mt-2 text-sm leading-6 text-slate-500">{item.payload.reason}</p> : null}
      </>
    );
  }

  if (item.kind === "PRACTICE_OUTPUT_CORRECTED") {
    const movedPractice =
      item.payload.before.practice.id !== item.payload.after.practice.id;
    return (
      <>
        <p className="font-medium text-slate-100">Updated a completed output</p>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {item.payload.before.title !== item.payload.after.title
            ? `${item.payload.before.title} → ${item.payload.after.title}`
            : item.payload.after.title}
        </p>
        {movedPractice ? (
          <p className="mt-1 text-xs leading-5 text-amber-200/70">
            Rebased from {item.payload.before.practice.name} to {item.payload.after.practice.name}.
          </p>
        ) : null}
      </>
    );
  }

  return (
    <>
      <p className="font-medium text-slate-100">Updated a past activity</p>
      <p className="mt-2 text-sm leading-6 text-slate-400">{item.payload.after.practice.name}</p>
    </>
  );
}

export function JourneyView({ journey }: { journey: JourneyRead }) {
  return (
    <div className="space-y-5">
      {journey.items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-slate-400">Nothing has been recorded in this period yet.</p>
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
                    <div className="absolute bottom-[-28px] top-7 w-px bg-white/[0.07]" />
                    <div className={`relative mt-5 h-2.5 w-2.5 rounded-full ${meta.dot} shadow-[0_0_0_5px_rgba(255,255,255,0.025)]`} />
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${meta.chip}`}>
                        <Icon className="h-3.5 w-3.5" /> {meta.label}
                      </span>
                      <span className="text-xs text-slate-600">{formatTime(item.timeline_at)}</span>
                    </div>
                    <JourneyItemBody item={item} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <details className="rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs text-slate-500">
        <summary className="cursor-pointer list-none px-4 py-3">About this view</summary>
        <div className="border-t border-white/[0.05] px-4 py-3 leading-5">
          <p>Journey is built from what you've recorded in Wayfinder. It is not meant to be a complete diary of your life.</p>
          <p className="mt-1">Some items are placed by when they happened; others by when they were added or changed.</p>
          {journey.result_coverage.reason === "RESULT_LIMIT" ? <p className="mt-1 text-amber-200/70">More recorded items exist outside this view.</p> : null}
        </div>
      </details>
    </div>
  );
}
