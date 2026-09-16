import { useMemo, useState } from "react";
import { Compass, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initializeCharacter } from "@/lib/wayfinder-rpc";

type Props = {
  onCreated: () => void;
};

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function CharacterCreationPage({ onCreated }: Props) {
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthTimeAccuracy, setBirthTimeAccuracy] = useState<"EXACT" | "APPROXIMATE">("EXACT");
  const [birthPlace, setBirthPlace] = useState("");
  const [heightValue, setHeightValue] = useState("");
  const [heightUnit, setHeightUnit] = useState<"in" | "cm" | "m">("in");
  const [weightValue, setWeightValue] = useState("");
  const [weightUnit, setWeightUnit] = useState<"lb" | "kg">("lb");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => displayName.trim().length > 0 && birthDate.trim().length > 0 && !submitting,
    [displayName, birthDate, submitting]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const height = parseOptionalNumber(heightValue);
    const weight = parseOptionalNumber(weightValue);

    if (!displayName.trim()) {
      setError("Choose the name Wayfinder should call you.");
      return;
    }
    if (!birthDate) {
      setError("Add your birth date so Wayfinder can establish your origin.");
      return;
    }
    if (Number.isNaN(height) || (height != null && height <= 0)) {
      setError("Height must be a positive number.");
      return;
    }
    if (Number.isNaN(weight) || (weight != null && weight <= 0)) {
      setError("Weight must be a positive number.");
      return;
    }

    setSubmitting(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const result = await initializeCharacter({
        displayName: displayName.trim(),
        birthDate,
        birthTimeLocal: birthTime || null,
        birthTimeAccuracy: birthTime ? birthTimeAccuracy : null,
        birthPlaceLabel: birthPlace.trim() || null,
        heightValue: height,
        heightUnit: height == null ? null : heightUnit,
        weightValue: weight,
        weightUnit: weight == null ? null : weightUnit,
        bodyObservedAt: new Date().toISOString(),
        bodyZoneId: timezone
      });

      if (result.status !== "APPLIED" && result.status !== "NOOP") {
        throw new Error(result.error_code ?? "Character creation was rejected.");
      }

      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Character creation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(110,231,183,0.12),transparent_32%),radial-gradient(circle_at_15%_70%,rgba(148,163,184,0.04),transparent_28%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10">
            <Compass className="h-5 w-5 text-emerald-300" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-500">Wayfinder</p>
            <p className="text-sm text-slate-300">Character Creation</p>
          </div>
        </header>

        <section className="my-auto py-12">
          <div className="mb-10 max-w-2xl">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[22px] border border-emerald-300/15 bg-emerald-300/[0.06]">
              <UserRound className="h-7 w-7 text-emerald-300" />
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-emerald-300/60">Establish the player</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl">Create your character.</h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">
              Start with a few grounded facts. Skills, roles, stats, XP, and the rest of your character are meant to emerge from your life later.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7 rounded-3xl border border-white/[0.07] bg-white/[0.025] p-6 sm:p-8">
            <div>
              <label className="text-sm font-medium text-slate-200" htmlFor="display-name">Name</label>
              <p className="mb-2 mt-1 text-xs text-slate-500">What should Wayfinder call you?</p>
              <Input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Sean" autoComplete="name" />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-200" htmlFor="birth-date">Birth date</label>
                <p className="mb-2 mt-1 text-xs text-slate-500">Your origin date.</p>
                <Input id="birth-date" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-200" htmlFor="birth-place">Birthplace</label>
                <p className="mb-2 mt-1 text-xs text-slate-500">Optional now; useful for a full birth chart.</p>
                <Input id="birth-place" value={birthPlace} onChange={(event) => setBirthPlace(event.target.value)} placeholder="Key West, FL" />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-[1fr_180px]">
              <div>
                <label className="text-sm font-medium text-slate-200" htmlFor="birth-time">Birth time</label>
                <p className="mb-2 mt-1 text-xs text-slate-500">Optional. Unknown stays unknown.</p>
                <Input id="birth-time" type="time" step="1" value={birthTime} onChange={(event) => setBirthTime(event.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-200" htmlFor="birth-accuracy">Accuracy</label>
                <p className="mb-2 mt-1 text-xs text-slate-500">Only applies if time is known.</p>
                <select
                  id="birth-accuracy"
                  value={birthTimeAccuracy}
                  disabled={!birthTime}
                  onChange={(event) => setBirthTimeAccuracy(event.target.value as "EXACT" | "APPROXIMATE")}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="EXACT">Exact</option>
                  <option value="APPROXIMATE">Approximate</option>
                </select>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-200" htmlFor="height">Starting height</label>
                <p className="mb-2 mt-1 text-xs text-slate-500">Optional body observation, not permanent identity.</p>
                <div className="flex gap-2">
                  <Input id="height" inputMode="decimal" value={heightValue} onChange={(event) => setHeightValue(event.target.value)} placeholder="69" />
                  <select
                    value={heightUnit}
                    onChange={(event) => setHeightUnit(event.target.value as "in" | "cm" | "m")}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="in">in</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-200" htmlFor="weight">Starting weight</label>
                <p className="mb-2 mt-1 text-xs text-slate-500">Optional observation that can change through time.</p>
                <div className="flex gap-2">
                  <Input id="weight" inputMode="decimal" value={weightValue} onChange={(event) => setWeightValue(event.target.value)} placeholder="152" />
                  <select
                    value={weightUnit}
                    onChange={(event) => setWeightUnit(event.target.value as "lb" | "kg")}
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="lb">lb</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.035] p-4">
              <div className="flex gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" />
                <p className="text-sm leading-6 text-slate-400">
                  This establishes your starting facts only. Wayfinder will learn the rest through evidence, discovery, and questions that matter instead of making you fill out a giant profile.
                </p>
              </div>
            </div>

            {error ? <p className="text-sm text-rose-300">{error}</p> : null}

            <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
              {submitting ? "Creating…" : "Enter Wayfinder"}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
