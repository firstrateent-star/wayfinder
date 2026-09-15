import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { History, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { correctPracticeSession } from "@/lib/wayfinder-rpc";
import type { HelmRead, PracticeSessionRead } from "@/lib/wayfinder-types";

function sessionLabel(session: PracticeSessionRead) {
  const when = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    .format(new Date(session.occurrence.from));
  return `${session.practice.name} · ${when}${session.focus ? ` · ${session.focus}` : ""}`;
}

function minutesFor(session: PracticeSessionRead) {
  if (session.duration_seconds) return String(Math.max(1, Math.round(session.duration_seconds / 60)));
  if (session.occurrence.to) {
    const ms = new Date(session.occurrence.to).getTime() - new Date(session.occurrence.from).getTime();
    return String(Math.max(1, Math.round(ms / 60_000)));
  }
  return "";
}

export function PracticeCorrection({ helm, onSaved }: { helm: HelmRead; onSaved: () => Promise<void> }) {
  const sessions = helm.practice.sessions;
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const selected = useMemo(() => sessions.find((session) => session.id === sessionId), [sessions, sessionId]);
  const [minutes, setMinutes] = useState(selected ? minutesFor(selected) : "");
  const [focus, setFocus] = useState(selected?.focus ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const attemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessions.some((session) => session.id === sessionId)) {
      setSessionId(sessions[0]?.id ?? "");
    }
  }, [sessions, sessionId]);

  useEffect(() => {
    if (!selected) return;
    setMinutes(minutesFor(selected));
    setFocus(selected.focus ?? "");
    attemptRef.current = null;
  }, [selected?.version]);

  const exactRange = Boolean(
    selected?.occurrence.to &&
    selected.occurrence.from_precision === "INSTANT" &&
    selected.occurrence.to_precision === "INSTANT"
  );

  function materialChanged() {
    attemptRef.current = null;
    setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;

    const durationMinutes = Number(minutes);
    if (exactRange && (!Number.isFinite(durationMinutes) || durationMinutes <= 0)) {
      setMessage("Enter a positive duration in minutes.");
      return;
    }

    const commandId = attemptRef.current ?? crypto.randomUUID();
    attemptRef.current = commandId;
    setSaving(true);
    setMessage(null);

    try {
      let occurredFrom = selected.occurrence.from;
      const occurredTo = selected.occurrence.to;
      let durationSeconds = selected.duration_seconds;

      if (exactRange && occurredTo) {
        const end = new Date(occurredTo);
        occurredFrom = new Date(end.getTime() - durationMinutes * 60_000).toISOString();
        durationSeconds = Math.round(durationMinutes * 60);
      }

      const result = await correctPracticeSession({
        sessionId: selected.id,
        expectedVersionId: selected.version,
        practiceId: selected.practice.id,
        occurredFrom,
        occurredTo,
        fromPrecision: selected.occurrence.from_precision,
        toPrecision: selected.occurrence.to_precision,
        zoneId: selected.occurrence.zone_id,
        durationSeconds,
        focus: focus.trim() || null,
        commandId
      });

      if (result.status === "REJECTED") {
        throw new Error(result.error_code ?? "PracticeSession correction was rejected.");
      }

      attemptRef.current = null;
      setMessage(result.replayed
        ? "That correction was already applied."
        : "Correction saved as a new version. Evidence tied to the prior version remains historical rather than silently moving.");
      await onSaved();
    } catch (cause) {
      setMessage(`${cause instanceof Error ? cause.message : "Correction failed."} Retry will reuse the same command identity.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
          <History className="h-4 w-4" /> Correction
        </div>
        <CardTitle>Correct a recorded session</CardTitle>
        <CardDescription>
          Corrections preserve history by creating a new PracticeSession version instead of rewriting the prior record.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
            No recent PracticeSession record is available to correct.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="correction-session" className="text-sm font-medium text-slate-300">Session</label>
              <select
                id="correction-session"
                value={sessionId}
                onChange={(event) => {
                  setSessionId(event.target.value);
                  attemptRef.current = null;
                  setMessage(null);
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-emerald-300/50"
              >
                {sessions.map((session) => <option key={session.id} value={session.id}>{sessionLabel(session)}</option>)}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
              <div className="space-y-2">
                <label htmlFor="correction-minutes" className="text-sm font-medium text-slate-300">Minutes</label>
                <Input
                  id="correction-minutes"
                  type="number"
                  min="1"
                  step="1"
                  disabled={!exactRange}
                  value={minutes}
                  onChange={(event) => {
                    setMinutes(event.target.value);
                    materialChanged();
                  }}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="correction-focus" className="text-sm font-medium text-slate-300">Focus</label>
                <Input
                  id="correction-focus"
                  value={focus}
                  onChange={(event) => {
                    setFocus(event.target.value);
                    materialChanged();
                  }}
                />
              </div>
            </div>

            {!exactRange ? (
              <p className="text-xs leading-5 text-slate-600">
                Duration editing is disabled for non-exact temporal records so the UI does not invent precision.
              </p>
            ) : null}
            {message ? <p className="text-sm leading-6 text-slate-400">{message}</p> : null}

            <Button type="submit" variant="secondary" disabled={saving || !selected}>
              <PencilLine className="mr-2 h-4 w-4" />
              {saving ? "Correcting…" : "Save correction"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
