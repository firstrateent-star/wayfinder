import { useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createScheduleAllocation } from "@/lib/schedule-rpc";
import { captureDirectionNode } from "@/lib/wayfinder-rpc";
import type { PositionQuestionOpportunity, PositionScheduleScope } from "@/lib/position-api";

type Step = "ASK" | "LABEL" | "TIME" | "DONE";

type Props = {
  question: PositionQuestionOpportunity | null;
  knownScheduleCount: number;
  scope: PositionScheduleScope;
  onSaved: () => Promise<void> | void;
  onClose: () => void;
};

function formatDay(scopeFrom: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "short", day: "numeric" }).format(new Date(scopeFrom));
}

function instantAtLocalTime(scopeFrom: string, time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const instant = new Date(scopeFrom);
  instant.setHours(hour, minute, 0, 0);
  return instant;
}

export function DiscoverySession({ question, knownScheduleCount, scope, onSaved, onClose }: Props) {
  const [step, setStep] = useState<Step>("ASK");
  const [label, setLabel] = useState("");
  const [focusText, setFocusText] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [savedDirection, setSavedDirection] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);

  const dayLabel = useMemo(() => formatDay(scope.from), [scope.from]);
  const concept = question?.informationNeed.concept ?? null;
  const directionQuestion = concept === "direction.current_focus";

  if (!question) {
    return (
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Sparkles className="h-4 w-4 text-emerald-300/80" />
              Navigator
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              I do not have another high-value discovery question ready yet. I would rather stay quiet than ask for information without a clear use.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close discovery">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  async function saveCommitment() {
    setError(null);
    if (!label.trim()) {
      setError("Give the commitment a short name first.");
      setStep("LABEL");
      return;
    }
    if (!startTime || !endTime) {
      setError("Add both a start and end time.");
      return;
    }
    if (startTime === endTime) {
      setError("Start and end time need to be different.");
      return;
    }

    const startsAt = instantAtLocalTime(scope.from, startTime);
    const endsAt = instantAtLocalTime(scope.from, endTime);
    if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);

    setSaving(true);
    try {
      const result = await createScheduleAllocation({
        label: label.trim(),
        kind: "HARD",
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        zoneId: scope.zoneId
      });

      if (result.status !== "APPLIED" && result.status !== "NOOP") {
        throw new Error(result.error_code ?? "Wayfinder rejected the schedule allocation.");
      }

      setSavedLabel(label.trim());
      setStep("DONE");
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wayfinder could not record that planned commitment.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDirection() {
    setError(null);
    const title = focusText.trim();
    if (!title) {
      setError("Give Wayfinder one current direction in your own words.");
      return;
    }

    setSaving(true);
    try {
      const result = await captureDirectionNode({
        kind: "direction",
        title
      });

      if (result.status !== "APPLIED" && result.status !== "NOOP") {
        throw new Error(result.error_code ?? "Wayfinder rejected the Direction record.");
      }

      setSavedDirection(title);
      setStep("DONE");
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wayfinder could not record that current direction.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-emerald-300/10 bg-emerald-300/[0.025] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
            <Sparkles className="h-4 w-4 text-emerald-300" />
            Navigator · Discovery
          </div>
          <p className="mt-1 text-xs text-slate-500">One question at a time. Each answer should change what Wayfinder can understand or do next.</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close discovery">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {step === "ASK" && directionQuestion ? (
        <div className="mt-6">
          <p className="text-base leading-7 text-slate-200">What is the one thing you are most actively trying to move forward right now?</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{question.whyThisMatters}</p>
          <Input
            className="mt-5"
            value={focusText}
            onChange={(event) => setFocusText(event.target.value)}
            placeholder="Build Wayfinder into something genuinely useful…"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && focusText.trim() && !saving) void saveDirection();
            }}
          />
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          <Button className="mt-4" disabled={saving || !focusText.trim()} onClick={() => void saveDirection()}>
            {saving ? "Connecting…" : "Use this as my current direction"}
          </Button>
          <p className="mt-3 text-xs leading-5 text-slate-600">This records an explicit current Direction. It does not assign a permanent Role, class, personality, or identity.</p>
        </div>
      ) : null}

      {step === "ASK" && !directionQuestion ? (
        <div className="mt-6">
          <p className="text-base leading-7 text-slate-200">
            {knownScheduleCount === 0
              ? `Before I try to orient ${dayLabel}, is there anything fixed — work, an appointment, an event, or somewhere you have to be?`
              : `I already know about ${knownScheduleCount} planned commitment${knownScheduleCount === 1 ? "" : "s"} on ${dayLabel}. Is anything else fixed that I should know about?`}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">{question.whyThisMatters}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => setStep("LABEL")}>Yes, something is fixed</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDeclined(true);
                setStep("DONE");
              }}
            >
              Nothing I need to add
            </Button>
          </div>
        </div>
      ) : null}

      {step === "LABEL" ? (
        <div className="mt-6">
          <button className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300" onClick={() => setStep("ASK")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <p className="text-base leading-7 text-slate-200">What should I call the commitment?</p>
          <Input
            className="mt-4"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Stage Presence, dentist, client shoot…"
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter" && label.trim()) setStep("TIME");
            }}
          />
          <Button className="mt-4" disabled={!label.trim()} onClick={() => setStep("TIME")}>
            Continue
          </Button>
        </div>
      ) : null}

      {step === "TIME" ? (
        <div className="mt-6">
          <button className="mb-4 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300" onClick={() => setStep("LABEL")}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <CalendarDays className="h-4 w-4 text-emerald-300/80" />
            {dayLabel}
          </div>
          <p className="mt-3 text-base leading-7 text-slate-200">When are you committed?</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500" htmlFor="discovery-start">Start</label>
              <Input id="discovery-start" className="mt-2" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500" htmlFor="discovery-end">End</label>
              <Input id="discovery-end" className="mt-2" type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Saving this means the time is planned. It will not count as evidence that the activity actually happened.
          </p>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
          <Button className="mt-5" disabled={saving || !startTime || !endTime} onClick={() => void saveCommitment()}>
            {saving ? "Recording…" : "Add to my planned time"}
          </Button>
        </div>
      ) : null}

      {step === "DONE" ? (
        <div className="mt-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/15 bg-emerald-300/[0.08]">
            <Check className="h-5 w-5 text-emerald-300" />
          </div>
          <p className="mt-4 text-base leading-7 text-slate-200">
            {savedDirection
              ? `Now I can organize discovery around “${savedDirection}” instead of collecting unrelated facts.`
              : savedLabel
                ? `Got it. ${savedLabel} is now part of your planned time for ${dayLabel}.`
                : declined
                  ? "Got it. I will not assume the day is completely free — only that you did not add another fixed commitment through this question."
                  : "That discovery step is complete."}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {savedDirection
              ? "Position will now combine that Direction with the time constraints you have already recorded. As more domains come online, the same loop can connect training, nutrition, money, gear, recovery, and evidence without turning them into one generic profile."
              : savedLabel
                ? "Position now recomputes the relationships between recorded commitments — including occupied time, overlaps, and between-commitment windows — rather than only storing the label you entered."
                : "Unknown stays unknown. Wayfinder can ask something else later when another answer has enough value to justify the interruption."}
          </p>
          <Button variant="secondary" className="mt-5" onClick={onClose}>Return to Helm</Button>
        </div>
      ) : null}
    </div>
  );
}
