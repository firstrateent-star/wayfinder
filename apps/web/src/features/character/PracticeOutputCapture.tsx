import { FormEvent, useMemo, useRef, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { capturePracticeOutput } from "@/lib/wayfinder-rpc";
import type { WayfinderStateRead } from "@/lib/wayfinder-state-api";

type SkillRead = WayfinderStateRead["skills"]["skills"][number];

function sessionLabel(encounter: SkillRead["experience"]["recentEncounters"][number]) {
  const when = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(encounter.occurredAt));
  return `${encounter.practice?.name ?? "Practice"} · ${when}`;
}

export function PracticeOutputCapture({
  skill,
  onSaved
}: {
  skill: SkillRead;
  onSaved: () => Promise<void>;
}) {
  const sessions = useMemo(
    () => skill.experience.recentEncounters.filter(
      (encounter) =>
        encounter.source.namespace === "practice" &&
        encounter.practice &&
        encounter.source.id &&
        encounter.source.version
    ),
    [skill.experience.recentEncounters]
  );

  const [sessionId, setSessionId] = useState(sessions[0]?.source.id ?? "");
  const [title, setTitle] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const attemptRef = useRef<string | null>(null);

  const selected = sessions.find((encounter) => encounter.source.id === sessionId) ?? sessions[0];

  if (skill.association.mode !== "GOVERNED_PRACTICE_ALIAS" || sessions.length === 0) {
    return null;
  }

  function materialChanged() {
    attemptRef.current = null;
    setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !title.trim()) return;

    setSaving(true);
    setMessage(null);
    const commandId = attemptRef.current ?? crypto.randomUUID();
    attemptRef.current = commandId;

    try {
      const result = await capturePracticeOutput({
        sourceSessionId: selected.source.id,
        sourceSessionVersionId: selected.source.version,
        title: title.trim(),
        externalUrl: externalUrl.trim() || null,
        commandId
      });

      if (result.status === "REJECTED") {
        throw new Error(result.error_code ?? "Practice Output was rejected.");
      }

      attemptRef.current = null;
      setTitle("");
      setExternalUrl("");
      setMessage(
        result.status === "NOOP" || result.replayed
          ? "That output command was already applied."
          : "Completed output recorded. Wayfinder can now use it as bounded capability evidence."
      );
      await onSaved();
    } catch (cause) {
      setMessage(
        `${cause instanceof Error ? cause.message : "Output capture failed."} Retry will reuse the same command identity.`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="mt-4 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.02]">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm text-emerald-100/75">
        Record a completed output
      </summary>
      <form onSubmit={submit} className="space-y-4 border-t border-emerald-300/10 px-4 py-4">
        <div className="space-y-2">
          <label htmlFor={`output-session-${skill.skillKey}`} className="text-xs font-medium text-slate-400">
            Practice session
          </label>
          <select
            id={`output-session-${skill.skillKey}`}
            value={selected?.source.id ?? ""}
            onChange={(event) => {
              setSessionId(event.target.value);
              materialChanged();
            }}
            className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-emerald-300/50"
          >
            {sessions.map((encounter) => (
              <option key={encounter.encounterKey} value={encounter.source.id}>
                {sessionLabel(encounter)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor={`output-title-${skill.skillKey}`} className="text-xs font-medium text-slate-400">
            Completed output
          </label>
          <Input
            id={`output-title-${skill.skillKey}`}
            placeholder={skill.label === "Music Production" ? "Song, mix, or finished piece" : "Drawing or finished piece"}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              materialChanged();
            }}
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor={`output-url-${skill.skillKey}`} className="text-xs font-medium text-slate-400">
            Evidence link <span className="text-slate-600">optional</span>
          </label>
          <Input
            id={`output-url-${skill.skillKey}`}
            type="url"
            placeholder="https://…"
            value={externalUrl}
            onChange={(event) => {
              setExternalUrl(event.target.value);
              materialChanged();
            }}
          />
        </div>

        {message ? <p className="text-xs leading-5 text-slate-400">{message}</p> : null}

        <Button type="submit" size="sm" disabled={saving || !selected || !title.trim()}>
          <FileCheck2 className="mr-2 h-4 w-4" />
          {saving ? "Recording…" : "Record completed output"}
        </Button>

        <p className="text-[11px] leading-5 text-slate-600">
          This records that a concrete output was completed from this exact Practice session. It does not rate quality,
          originality, mastery, or commercial success.
        </p>
      </form>
    </details>
  );
}
