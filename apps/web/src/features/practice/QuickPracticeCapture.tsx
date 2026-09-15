import { FormEvent, useMemo, useRef, useState } from "react";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createPractice, logPracticeSession } from "@/lib/wayfinder-rpc";
import type { HelmRead } from "@/lib/wayfinder-types";

type PendingAttempt = {
  createPracticeCommandId: string;
  logSessionCommandId: string;
  practiceId?: string;
};

export function QuickPracticeCapture({ helm, onSaved }: { helm: HelmRead; onSaved: () => Promise<void> }) {
  const knownPractices = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    helm.practice.sessions.forEach((session) => map.set(session.practice.id, session.practice));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [helm.practice.sessions]);

  const [practiceId, setPracticeId] = useState(knownPractices[0]?.id ?? "");
  const [newPracticeName, setNewPracticeName] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [focus, setFocus] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const attemptRef = useRef<PendingAttempt | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const durationMinutes = Number(minutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setMessage("Enter a positive duration in minutes.");
      setSaving(false);
      return;
    }

    const attempt = attemptRef.current ?? {
      createPracticeCommandId: crypto.randomUUID(),
      logSessionCommandId: crypto.randomUUID()
    };
    attemptRef.current = attempt;

    try {
      let resolvedPracticeId = practiceId || attempt.practiceId;

      if (!resolvedPracticeId) {
        if (!newPracticeName.trim()) throw new Error("Choose a recorded Practice or name a new one.");
        const created = await createPractice({
          name: newPracticeName.trim(),
          commandId: attempt.createPracticeCommandId
        });
        if (created.status === "REJECTED") throw new Error(created.error_code ?? "Practice creation was rejected.");
        resolvedPracticeId = created.affected_refs.find((ref) => ref.type === "practice")?.id;
        if (!resolvedPracticeId) throw new Error("Practice was created but its reference was not returned.");
        attempt.practiceId = resolvedPracticeId;
        setPracticeId(resolvedPracticeId);
      }

      const end = new Date();
      const start = new Date(end.getTime() - durationMinutes * 60_000);
      const result = await logPracticeSession({
        practiceId: resolvedPracticeId,
        occurredFrom: start.toISOString(),
        occurredTo: end.toISOString(),
        fromPrecision: "INSTANT",
        toPrecision: "INSTANT",
        zoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        durationSeconds: Math.round(durationMinutes * 60),
        focus: focus.trim() || null,
        commandId: attempt.logSessionCommandId
      });

      if (result.status === "REJECTED") throw new Error(result.error_code ?? "Practice session was rejected.");

      attemptRef.current = null;
      setFocus("");
      setNewPracticeName("");
      setMessage(result.status === "NOOP" ? "That session was already recorded." : "Practice session recorded.");
      await onSaved();
    } catch (cause) {
      setMessage(`${cause instanceof Error ? cause.message : "Capture failed."} Retry will reuse the same command identity.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/80">
          <Plus className="h-4 w-4" /> Capture
        </div>
        <CardTitle>Record a practice session</CardTitle>
        <CardDescription>Capture what just happened. The backend remains authoritative.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {knownPractices.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300" htmlFor="practice-select">Recorded Practice</label>
              <select
                id="practice-select"
                value={practiceId}
                onChange={(event) => {
                  setPracticeId(event.target.value);
                  attemptRef.current = null;
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-emerald-300/50"
              >
                <option value="">Create a new Practice…</option>
                {knownPractices.map((practice) => (
                  <option key={practice.id} value={practice.id}>{practice.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          {!practiceId ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300" htmlFor="new-practice">New Practice</label>
              <Input
                id="new-practice"
                placeholder="Music production, drawing, Spanish…"
                value={newPracticeName}
                onChange={(event) => {
                  setNewPracticeName(event.target.value);
                  attemptRef.current = null;
                }}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300" htmlFor="minutes">Minutes</label>
              <Input id="minutes" type="number" min="1" step="1" value={minutes} onChange={(event) => { setMinutes(event.target.value); attemptRef.current = null; }} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300" htmlFor="focus">Focus</label>
              <Input id="focus" placeholder="What did you work on?" value={focus} onChange={(event) => { setFocus(event.target.value); attemptRef.current = null; }} />
            </div>
          </div>

          {message ? <p className="text-sm text-slate-400">{message}</p> : null}
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Recording…" : "Record session"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
