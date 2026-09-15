import { FormEvent, useMemo, useRef, useState } from "react";
import { Flag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { captureDirectionNode } from "@/lib/wayfinder-rpc";
import type { HelmRead } from "@/lib/wayfinder-types";

type Kind = "direction" | "outcome" | "quest" | "action";

type PendingAttempt = {
  commandId: string;
};

function kindLabel(kind: Kind) {
  if (kind === "action") return "Next action";
  if (kind === "direction") return "Direction";
  if (kind === "outcome") return "Outcome";
  return "Quest";
}

export function QuickDirectionCapture({ helm, onSaved }: { helm: HelmRead; onSaved: () => Promise<void> }) {
  const [kind, setKind] = useState<Kind>("action");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [supportsTargetId, setSupportsTargetId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const attemptRef = useRef<PendingAttempt | null>(null);

  const possibleTargets = useMemo(
    () => helm.direction.nodes.filter((node) => node.intent_state === "ACTIVE" && ["direction", "outcome", "quest"].includes(node.kind)),
    [helm.direction.nodes]
  );

  function materialChanged() {
    attemptRef.current = null;
    setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (!title.trim()) return;

    const attempt = attemptRef.current ?? { commandId: crypto.randomUUID() };
    attemptRef.current = attempt;
    setSaving(true);

    try {
      const created = await captureDirectionNode({
        kind,
        title: title.trim(),
        description: description.trim() || undefined,
        supportsTargetId: kind === "action" && supportsTargetId ? supportsTargetId : null,
        commandId: attempt.commandId
      });
      if (created.status === "REJECTED") {
        throw new Error(created.error_code ?? "That could not be saved.");
      }

      attemptRef.current = null;
      setTitle("");
      setDescription("");
      setSupportsTargetId("");
      setMessage(created.replayed ? "Already saved — no duplicate was created." : "Saved.");
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
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
          <Flag className="h-4 w-4" /> Set direction
        </div>
        <CardTitle>What matters next?</CardTitle>
        <CardDescription>Add something you want to move toward.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
            <div className="space-y-2">
              <label htmlFor="direction-kind" className="text-sm font-medium text-slate-300">Type</label>
              <select
                id="direction-kind"
                value={kind}
                onChange={(event) => {
                  const nextKind = event.target.value as Kind;
                  setKind(nextKind);
                  if (nextKind !== "action") setSupportsTargetId("");
                  materialChanged();
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-emerald-300/50"
              >
                <option value="action">Next action</option>
                <option value="direction">Direction</option>
                <option value="outcome">Outcome</option>
                <option value="quest">Quest</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="direction-title" className="text-sm font-medium text-slate-300">What is it?</label>
              <Input
                id="direction-title"
                placeholder="Finish a track, get stronger, launch the site…"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  materialChanged();
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="direction-description" className="text-sm font-medium text-slate-300">Why does it matter? <span className="text-slate-600">optional</span></label>
            <Input
              id="direction-description"
              placeholder="A short note for yourself"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                materialChanged();
              }}
            />
          </div>

          {kind === "action" && possibleTargets.length > 0 ? (
            <div className="space-y-2">
              <label htmlFor="supports-target" className="text-sm font-medium text-slate-300">This helps me move toward <span className="text-slate-600">optional</span></label>
              <select
                id="supports-target"
                value={supportsTargetId}
                onChange={(event) => {
                  setSupportsTargetId(event.target.value);
                  materialChanged();
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-emerald-300/50"
              >
                <option value="">Nothing specific yet</option>
                {possibleTargets.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}
              </select>
            </div>
          ) : null}

          {message ? <p className="text-sm text-slate-400">{message}</p> : null}
          <Button type="submit" disabled={saving || !title.trim()} variant="secondary">
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : `Save ${kindLabel(kind).toLowerCase()}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
