import { FormEvent, useRef, useState } from "react";
import { AlertTriangle, ExternalLink, FileCheck2, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { correctPracticeOutput } from "@/lib/wayfinder-rpc";
import type {
  PracticeOutputCatalogItem,
  PracticeOutputAlignmentState,
  PracticeOutputsRead
} from "@/lib/wayfinder-types";

function formatMoment(value: string | null) {
  if (!value) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function statusMeta(output: PracticeOutputCatalogItem) {
  if (output.capability_eligible) {
    if (output.alignment_state === "SOURCE_VERSION_ADVANCED") {
      return {
        label: "Current · session updated",
        className: "border-sky-300/20 bg-sky-300/[0.07] text-sky-200",
        copy: "The source session was corrected, but it still belongs to the same Practice. This output remains usable evidence."
      };
    }
    return {
      label: "Current",
      className: "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200",
      copy: "This output currently contributes to its governed creative Capability model."
    };
  }

  if (output.alignment_state === "PRACTICE_MISMATCH") {
    return {
      label: "Needs review",
      className: "border-amber-300/20 bg-amber-300/[0.08] text-amber-200",
      copy:
        "The source session now belongs to a different Practice. Wayfinder will not move this output to another Skill without your explicit correction."
    };
  }

  if (output.alignment_state === "OUTPUT_RETRACTED") {
    return {
      label: "Retracted",
      className: "border-slate-300/15 bg-white/[0.03] text-slate-400",
      copy: "This output remains in history but does not contribute to current Capability."
    };
  }

  const messages: Partial<Record<PracticeOutputAlignmentState, string>> = {
    SOURCE_SESSION_UNRESOLVED: "The source session cannot currently be resolved.",
    SOURCE_SESSION_NOT_ACTIVE: "The source session is no longer active.",
    SOURCE_PRACTICE_NOT_ACTIVE: "The Practice currently owning the source session is not active.",
    RECORDED_PRACTICE_NOT_ACTIVE: "The Practice recorded on this output is no longer active.",
    SOURCE_OCCURRENCE_AFTER_AS_OF: "The source occurrence is outside the current evidence horizon."
  };

  return {
    label: "Not currently usable",
    className: "border-amber-300/15 bg-amber-300/[0.05] text-amber-100/70",
    copy: messages[output.alignment_state] ?? "Current records do not support using this output as Capability evidence."
  };
}

function OutputEditor({
  output,
  onChanged
}: {
  output: PracticeOutputCatalogItem;
  onChanged: () => Promise<void>;
}) {
  const [title, setTitle] = useState(output.title);
  const [url, setUrl] = useState(output.external_url ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const attemptRef = useRef<string | null>(null);

  const currentSourceVersion = output.source_session.current_version;
  const currentPractice = output.source_session.current_practice;
  const willMove =
    output.can_rebase &&
    currentPractice &&
    currentPractice.id !== output.recorded_practice.id;

  function changed() {
    attemptRef.current = null;
    setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!currentSourceVersion || !title.trim()) return;

    setSaving(true);
    setMessage(null);
    const commandId = attemptRef.current ?? crypto.randomUUID();
    attemptRef.current = commandId;

    try {
      const result = await correctPracticeOutput({
        outputId: output.id,
        expectedVersionId: output.version,
        sourceSessionVersionId: currentSourceVersion,
        title: title.trim(),
        externalUrl: url.trim() || null,
        commandId
      });

      if (result.status === "REJECTED") {
        throw new Error(result.error_code ?? "Practice Output correction was rejected.");
      }

      attemptRef.current = null;
      setMessage(
        result.status === "NOOP" || result.replayed
          ? "That correction was already applied."
          : willMove
            ? `Output moved to ${currentPractice?.name ?? "the source session's current Practice"}.`
            : "Output updated."
      );
      await onChanged();
    } catch (cause) {
      setMessage(
        `${cause instanceof Error ? cause.message : "Output correction failed."} Retry will reuse the same command identity.`
      );
    } finally {
      setSaving(false);
    }
  }

  if (!output.can_correct || !currentSourceVersion) return null;

  return (
    <details className="mt-3 rounded-lg border border-white/[0.06] bg-black/10">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-xs text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <PencilLine className="h-3.5 w-3.5" />
          {willMove ? "Review and rebase" : "Edit output"}
        </span>
      </summary>
      <form onSubmit={submit} className="space-y-3 border-t border-white/[0.05] px-3 py-3">
        {willMove ? (
          <div className="rounded-lg border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100/75">
            This output is recorded under <strong>{output.recorded_practice.name}</strong>, while its source session now belongs to{" "}
            <strong>{currentPractice?.name}</strong>. Saving this correction will explicitly move the output to {currentPractice?.name}.
          </div>
        ) : null}

        <Input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            changed();
          }}
          aria-label="Completed output title"
          required
        />
        <Input
          type="url"
          value={url}
          placeholder="https://… (optional)"
          onChange={(event) => {
            setUrl(event.target.value);
            changed();
          }}
          aria-label="Completed output evidence link"
        />

        {message ? <p className="text-xs leading-5 text-slate-400">{message}</p> : null}

        <Button type="submit" size="sm" disabled={saving || !title.trim()}>
          {saving ? "Saving…" : willMove ? `Save & move to ${currentPractice?.name}` : "Save correction"}
        </Button>
      </form>
    </details>
  );
}

export function PracticeOutputsManager({
  read,
  onChanged
}: {
  read: PracticeOutputsRead;
  onChanged: () => Promise<void>;
}) {
  if (read.outputs.length === 0) return null;

  const needsAttention = read.outputs.filter((output) => output.needs_attention).length;

  return (
    <section className="mt-7 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-fuchsia-300/55">Practice outputs</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">Completed work in your record</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            These are canonical completed outputs, shown independently of whether they currently qualify for a Skill projection.
          </p>
        </div>
        {needsAttention ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-3 py-1.5 text-xs text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            {needsAttention} need{needsAttention === 1 ? "s" : ""} review
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        {read.outputs.map((output) => {
          const status = statusMeta(output);
          return (
            <div key={output.id} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-fuchsia-300/60" />
                    <p className="font-medium text-slate-100">{output.title}</p>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {output.recorded_practice.name} · recorded {formatMoment(output.recorded_at)}
                  </p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${status.className}`}>
                  {status.label}
                </span>
              </div>

              <p className="mt-3 text-xs leading-5 text-slate-500">{status.copy}</p>

              {output.alignment_state === "PRACTICE_MISMATCH" && output.source_session.current_practice ? (
                <p className="mt-2 text-xs leading-5 text-amber-100/65">
                  Source session now belongs to {output.source_session.current_practice.name}.
                </p>
              ) : null}

              {output.external_url ? (
                <a
                  href={output.external_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-flex items-center gap-1.5 text-xs text-fuchsia-200/70 hover:text-fuchsia-200"
                >
                  Evidence link <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}

              <OutputEditor output={output} onChanged={onChanged} />
            </div>
          );
        })}
      </div>

      {read.result_coverage.reason === "RESULT_LIMIT" ? (
        <p className="text-xs text-amber-200/70">More Practice Outputs exist outside this view.</p>
      ) : null}
    </section>
  );
}
