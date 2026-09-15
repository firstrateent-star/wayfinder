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
        throw new Error(created.error_code ?? "Direction capture was rejected.");
      }

      attemptRef.current = null;
      setTitle("");
      setDescription("");
      setSupportsTargetId("");
      setMessage(created.replayed ? "That capture was already applied; no duplicate was created." : "Direction record saved.");
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
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
          <Flag className="h-4 w-4" /> Direction capture
        </div>
        <CardTitle>Record what matters next</CardTitle>
        <CardDescription>
          Intent stays separate from reality. A new Action and its optional SUPPORTS relationship are saved atomically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <div className="space-y-2">
              <label htmlFor="direction-kind" className="text-sm font-medium text-slate-300">Kind</label>
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
                <option value="action">Action</option>
                <option value="direction">Direction</option>
                <option value="outcome">Outcome</option>
                <option value="quest">Quest</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="direction-title" className="text-sm font-medium text-slate-300">Title</label>
              <Input
                id="direction-title"
                placeholder="Practice synthesis, finish a track…"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  materialChanged();
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="direction-description" className="text-sm font-medium text-slate-300">Context <span className="text-slate-600">optional</span></label>
            <Input
              id="direction-description"
              placeholder="Why this matters or what it means"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                materialChanged();
              }}
            />
          </div>

          {kind === "action" && possibleTargets.length > 0 ? (
            <div className="space-y-2">
              <label htmlFor="supports-target" className="text-sm font-medium text-slate-300">Supports <span className="text-slate-600">optional</span></label>
              <select
                id="supports-target"
                value={supportsTargetId}
                onChange={(event) => {
                  setSupportsTargetId(event.target.value);
                  materialChanged();
                }}
                className="h-10 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none focus:border-emerald-300/50"
              >
                <option value="">No relationship yet</option>
                {possibleTargets.map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}
              </select>
            </div>
          ) : null}

          {message ? <p className="text-sm text-slate-400">{message}</p> : null}
          <Button type="submit" disabled={saving || !title.trim()} variant="secondary">
            <Plus className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : `Create ${kind}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
