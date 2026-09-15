import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { attachFulfillmentEvidence } from "@/lib/wayfinder-rpc";
import type { HelmRead } from "@/lib/wayfinder-types";

function sessionLabel(session: HelmRead["practice"]["sessions"][number]) {
  const when = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    .format(new Date(session.occurrence.from));
  const focus = session.focus ? ` · ${session.focus}` : "";
  return `${session.practice.name} · ${when}${focus}`;
}

export function EvidenceLinkCapture({ helm, onSaved }: { helm: HelmRead; onSaved: () => Promise<void> }) {
  const sessions = helm.practice.sessions;
  const actions = helm.bearing.actions;
  const [sessionId, setSessionId] = useState(sessions[0]?.id ?? "");
  const [actionId, setActionId] = useState(actions[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const attemptRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessions.some((session) => session.id === sessionId)) {
      setSessionId(sessions[0]?.id ?? "");
      attemptRef.current = null;
    }
  }, [sessions, sessionId]);

  useEffect(() => {
    if (!actions.some((action) => action.id === actionId)) {
      setActionId(actions[0]?.id ?? "");
      attemptRef.current = null;
    }
  }, [actions, actionId]);

  const selectedSession = sessions.find((session) => session.id === sessionId);
  const selectedAction = actions.find((action) => action.id === actionId);

  const alreadyLinked = useMemo(() => {
    if (!selectedSession || !selectedAction) return false;
    return selectedAction.qualifying_lineage.some(
      (item) => item.source.id === selectedSession.id && item.source.version === selectedSession.version
    );
  }, [selectedAction, selectedSession]);

  function materialChanged() {
    attemptRef.current = null;
    setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedSession || !selectedAction || alreadyLinked) return;

    setSaving(true);
    setMessage(null);
    const commandId = attemptRef.current ?? crypto.randomUUID();
    attemptRef.current = commandId;

    try {
      const result = await attachFulfillmentEvidence({
        sourceSessionId: selectedSession.id,
        sourceVersionId: selectedSession.version,
        targetActionId: selectedAction.id,
        targetVersionId: selectedAction.version,
        reason: reason.trim() || undefined,
        commandId
      });
      if (result.status === "REJECTED") {
        throw new Error(result.error_code ?? "Evidence link was rejected.");
      }

      attemptRef.current = null;
      setReason("");
      setMessage(result.status === "NOOP" || result.replayed
        ? "That exact evidence lineage was already recorded."
        : "Evidence attached. Bearing can now use this exact recorded lineage.");
      await onSaved();
    } catch (cause) {
      setMessage(`${cause instanceof Error ? cause.message : "Evidence attachment failed."} Retry will reuse the same command identity.`);
    } finally {
      setSaving(false);
    }
  }

  const unavailable = sessions.length === 0 || actions.length === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/80">
          <Link2 className="h-4 w-4" /> Evidence
        </div>
        <CardTitle>Connect reality to direction</CardTitle>
        <CardDescription>
          Link an exact current PracticeSession version to an exact current Action version as recorded fulfillment evidence.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unavailable ? (
          <div className="rounded-xl border border-dashed border-white/10 p-4 text-sm leading-6 text-slate-500">
            {sessions.length === 0
              ? "Record a PracticeSession first."
              : "Create an active Action first."}
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="evidence-session" className="text-sm font-medium text-slate-300">Recorded session</label>
              <select
                id="evidence-session"
                value={sessionId}
                onChange={(event) => {
                  setSessionId(event.target.value);
                  materialChanged();
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-emerald-300/50"
              >
                {sessions.map((session) => <option key={session.id} value={session.id}>{sessionLabel(session)}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="evidence-action" className="text-sm font-medium text-slate-300">Action this supports</label>
              <select
                id="evidence-action"
                value={actionId}
                onChange={(event) => {
                  setActionId(event.target.value);
                  materialChanged();
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-emerald-300/50"
              >
                {actions.map((action) => <option key={action.id} value={action.id}>{action.title}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="evidence-reason" className="text-sm font-medium text-slate-300">Why it supports this Action <span className="text-slate-600">optional</span></label>
              <Input
                id="evidence-reason"
                placeholder="What does this session evidence?"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  materialChanged();
                }}
              />
            </div>

            {alreadyLinked ? (
              <p className="text-sm text-emerald-200/70">This exact session version is already linked to this exact Action version.</p>
            ) : null}
            {message ? <p className="text-sm text-slate-400">{message}</p> : null}

            <Button type="submit" disabled={saving || alreadyLinked || !selectedSession || !selectedAction}>
              <Link2 className="mr-2 h-4 w-4" />
              {saving ? "Linking…" : alreadyLinked ? "Evidence already linked" : "Attach evidence"}
            </Button>

            <p className="text-xs leading-5 text-slate-600">
              This does not mark the Action “complete.” It records a versioned evidence relationship that projections may interpret.
            </p>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
