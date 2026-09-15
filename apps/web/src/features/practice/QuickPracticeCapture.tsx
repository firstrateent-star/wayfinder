import { FormEvent, useMemo, useRef, useState } from "react";
import { Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { capturePracticeSession } from "@/lib/wayfinder-rpc";
import type { HelmRead } from "@/lib/wayfinder-types";

type PendingAttempt = {
  commandId: string;
};

export function QuickPracticeCapture({ helm, onSaved }: { helm: HelmRead; onSaved: () => Promise<void> }) {
  const knownPractices = useMemo(
    () => helm.practice_catalog.practices
      .filter((practice) => practice.capture_preferred)
      .sort((a, b) => a.name.localeCompare(b.name)),
    [helm.practice_catalog.practices]
  );

  const [practiceId, setPracticeId] = useState(knownPractices[0]?.id ?? "");
  const [newPracticeName, setNewPracticeName] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [focus, setFocus] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const attemptRef = useRef<PendingAttempt | null>(null);

  function materialChanged() {
    attemptRef.current = null;
    setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const durationMinutes = Number(minutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setMessage("Enter how many minutes you spent.");
      setSaving(false);
      return;
    }
    if (!practiceId && !newPracticeName.trim()) {
      setMessage("Choose an activity or name a new one.");
      setSaving(false);
      return;
    }

    const attempt = attemptRef.current ?? { commandId: crypto.randomUUID() };
    attemptRef.current = attempt;

    try {
      const end = new Date();
      const start = new Date(end.getTime() - durationMinutes * 60_000);
      const result = await capturePracticeSession({
        practiceId: practiceId || null,
        newPracticeName: practiceId ? null : newPracticeName.trim(),
        occurredFrom: start.toISOString(),
        occurredTo: end.toISOString(),
        fromPrecision: "INSTANT",
        toPrecision: "INSTANT",
        zoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        durationSeconds: Math.round(durationMinutes * 60),
        focus: focus.trim() || null,
        commandId: attempt.commandId
      });

      if (result.status === "REJECTED") {
        throw new Error(result.error_code ?? "That activity could not be saved.");
      }

      const resolvedPracticeId = result.affected_refs.find((ref) => ref.type === "practice")?.id;
      if (resolvedPracticeId) setPracticeId(resolvedPracticeId);

      attemptRef.current = null;
      setFocus("");
      setNewPracticeName("");
      setMessage(result.replayed ? "Already saved — no duplicate was created." : "Saved.");
      await onSaved();
    } catch (cause) {
      setMessage(`${cause instanceof Error ? cause.message : "Save failed."} You can try again.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-emerald-300/80">
          <Plus className="h-4 w-4" /> Log activity
        </div>
        <CardTitle>What did you just do?</CardTitle>
        <CardDescription>Add a quick record of something you spent time on.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {knownPractices.length > 0 ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300" htmlFor="practice-select">Activity</label>
              <select
                id="practice-select"
                value={practiceId}
                onChange={(event) => {
                  setPracticeId(event.target.value);
                  materialChanged();
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-emerald-300/50"
              >
                <option value="">Something new…</option>
                {knownPractices.map((practice) => (
                  <option key={practice.id} value={practice.id}>{practice.name}</option>
                ))}
              </select>
            </div>
          ) : null}

          {!practiceId ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300" htmlFor="new-practice">Name it</label>
              <Input
                id="new-practice"
                placeholder="Music production, drawing, reading…"
                value={newPracticeName}
                onChange={(event) => {
                  setNewPracticeName(event.target.value);
                  materialChanged();
                }}
              />
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300" htmlFor="minutes">Minutes</label>
              <Input
                id="minutes"
                type="number"
                min="1"
                step="1"
                value={minutes}
                onChange={(event) => {
                  setMinutes(event.target.value);
                  materialChanged();
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300" htmlFor="focus">What were you working on?</label>
              <Input
                id="focus"
                placeholder="Optional"
                value={focus}
                onChange={(event) => {
                  setFocus(event.target.value);
                  materialChanged();
                }}
              />
            </div>
          </div>

          {message ? <p className="text-sm text-slate-400">{message}</p> : null}
          <Button type="submit" disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save activity"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
