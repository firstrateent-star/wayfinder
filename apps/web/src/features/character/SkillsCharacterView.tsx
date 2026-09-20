import { Activity, CircleDot, Dumbbell, History, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { WayfinderStateRead } from "@/lib/wayfinder-state-api";

type SkillRead = WayfinderStateRead["skills"]["skills"][number];

function formatMoment(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function plural(value: number, singular: string, pluralForm = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralForm}`;
}

function sharpnessLabel(skill: SkillRead) {
  const sharpness = skill.sharpness;
  if (sharpness.state === "SHARP") return "Sharp";
  if (sharpness.state === "WARM") return "Warm";
  if (sharpness.state === "COOL") return "Cool";
  if (sharpness.state === "DORMANT") return "Dormant";
  if (sharpness.state === "UNESTABLISHED") return "Cadence not established";
  if (sharpness.state === "UNOBSERVED") return "No recorded practice";
  return "Unknown";
}

function sharpnessCopy(skill: SkillRead) {
  if (skill.sharpness.mode === "CADENCE_AWARE") {
    return "Compared with your recorded practice cadence.";
  }
  if (skill.sharpness.mode === "RECENCY_ONLY") {
    return "Wayfinder knows when you last practiced, but not enough history exists to establish your cadence.";
  }
  if (skill.sharpness.mode === "UNOBSERVED") {
    return "No governed practice encounter is recorded for this Skill.";
  }
  return "Current practice recency cannot be established from the available evidence.";
}

function capabilityLabel(skill: SkillRead) {
  if (skill.capability.state === "EVIDENCED") return "Demonstrated";
  if (skill.capability.state === "INSUFFICIENT_EVIDENCE") return "Not established";
  return "Unknown";
}

function skillStateClass(skill: SkillRead) {
  if (skill.state === "OBSERVED") return "border-emerald-300/15 bg-emerald-300/[0.025]";
  return "border-white/[0.06] bg-white/[0.018]";
}

function sharpnessClass(skill: SkillRead) {
  if (skill.sharpness.state === "SHARP") return "text-emerald-200";
  if (skill.sharpness.state === "WARM") return "text-lime-200/80";
  if (skill.sharpness.state === "COOL") return "text-sky-200/80";
  if (skill.sharpness.state === "DORMANT") return "text-slate-400";
  return "text-slate-500";
}

function capabilityClass(skill: SkillRead) {
  if (skill.capability.state === "EVIDENCED") return "text-emerald-200";
  if (skill.capability.state === "INSUFFICIENT_EVIDENCE") return "text-amber-100/65";
  return "text-slate-500";
}

function SkillCard({ skill }: { skill: SkillRead }) {
  const experienceCount = skill.experience.encounterCount;
  const lastPractice = formatMoment(skill.experience.lastEvidencedAt);
  const capability = skill.capability;
  const hasFrontiers = capability.exerciseFrontiers.length > 0;

  return (
    <Card className={skillStateClass(skill)}>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/55">
              <CircleDot className="h-3.5 w-3.5" />
              Skill
            </div>
            <CardTitle className="mt-2 text-xl">{skill.label}</CardTitle>
            <CardDescription className="mt-1">
              Evidence-backed progression without a fabricated level.
            </CardDescription>
          </div>
          <span className="rounded-full border border-white/[0.07] bg-black/10 px-2.5 py-1 text-xs text-slate-500">
            {skill.state === "OBSERVED" ? "Recorded" : skill.state === "UNOBSERVED" ? "Unobserved" : "Unknown"}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">Experience</p>
            <p className="mt-2 text-sm font-medium text-slate-200">
              {experienceCount == null
                ? "Unknown"
                : experienceCount === 0
                  ? "No recorded encounters"
                  : plural(experienceCount, "encounter")}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {lastPractice ? `Last recorded ${lastPractice}` : "Based only on governed recorded encounters."}
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">Sharpness</p>
            <p className={`mt-2 text-sm font-medium ${sharpnessClass(skill)}`}>
              {sharpnessLabel(skill)}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{sharpnessCopy(skill)}</p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-black/10 p-3.5">
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">Capability</p>
            <p className={`mt-2 text-sm font-medium ${capabilityClass(skill)}`}>
              {capabilityLabel(skill)}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {capability.state === "EVIDENCED"
                ? "Grounded in governed demonstration evidence."
                : capability.state === "INSUFFICIENT_EVIDENCE"
                  ? "Recorded evidence does not yet establish this capability. This is not a zero-ability claim."
                  : "No governed capability provider currently establishes this Skill."}
            </p>
          </div>
        </div>

        {hasFrontiers ? (
          <div className="mt-4 rounded-xl border border-emerald-300/10 bg-emerald-300/[0.025] p-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-emerald-300/60" />
              <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-emerald-300/55">
                Demonstrated performance
              </p>
            </div>
            <div className="mt-3 space-y-3">
              {capability.exerciseFrontiers.map((frontier) => (
                <div key={frontier.exerciseKey}>
                  <p className="text-sm font-medium text-slate-200">{frontier.exerciseLabel}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {frontier.points.map((point) => (
                      <span
                        key={point.source.id}
                        className="rounded-full border border-white/[0.07] bg-black/15 px-3 py-1.5 text-xs text-slate-300"
                      >
                        {point.loadValue} {point.loadUnit} × {point.reps}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-4 text-slate-600">
              These are exercise-specific non-dominated load × reps demonstrations. Wayfinder does not combine them into one strength score or estimate a one-rep max.
            </p>
          </div>
        ) : null}

        <details className="mt-4 rounded-xl border border-white/[0.05] bg-black/[0.08] text-xs text-slate-500">
          <summary className="cursor-pointer list-none px-3.5 py-3">Evidence details</summary>
          <div className="space-y-3 border-t border-white/[0.05] px-3.5 py-3 leading-5">
            <div>
              <p className="text-slate-400">Experience</p>
              <p>
                {experienceCount == null
                  ? "Exact recorded encounter count is unavailable."
                  : `${plural(experienceCount, "governed encounter")} currently contributes to this Skill projection.`}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Capability</p>
              <p>{capability.note}</p>
              {capability.demonstrationCount != null ? (
                <p className="mt-1">
                  {plural(capability.demonstrationCount, "qualifying demonstration")} across{" "}
                  {capability.demonstratedExerciseCount ?? 0} recorded exercise
                  {(capability.demonstratedExerciseCount ?? 0) === 1 ? "" : "s"}.
                </p>
              ) : null}
            </div>
            <p>
              Mastery is not evaluated. Missing or incomplete evidence is never converted into a zero Skill Level.
            </p>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export function SkillsCharacterView({ state }: { state: WayfinderStateRead }) {
  const skills = [...state.skills.skills].sort((a, b) => {
    const observedA = a.state === "OBSERVED" ? 0 : 1;
    const observedB = b.state === "OBSERVED" ? 0 : 1;
    return observedA - observedB || a.label.localeCompare(b.label);
  });
  const evidencedFacets = state.character.evidenced_facets;
  const voyageXp = state.progression.voyage_xp;

  return (
    <div className="space-y-5">
      <Card className="border-white/[0.06] bg-white/[0.02]">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600">
              <Activity className="h-3.5 w-3.5" /> Voyage
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-100">
              {voyageXp == null ? "Unknown" : `${voyageXp} XP`}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">Participation experience, not capability.</p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600">
              <Sparkles className="h-3.5 w-3.5" /> Skills
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-100">
              {state.skills.observed_skill_count} observed
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {state.skills.configured_skill_count} governed Skill concept{state.skills.configured_skill_count === 1 ? "" : "s"} currently configured.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-600">
              <History className="h-3.5 w-3.5" /> Character evidence
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-100">
              {evidencedFacets.length ? evidencedFacets.join(" · ") : "Still emerging"}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">No numeric attributes are inferred from missing evidence.</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300/55">Skills</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-100">What your evidence can support</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Experience, Sharpness, and Capability answer different questions. Wayfinder keeps them separate rather than turning your life into one arbitrary score.
        </p>
      </div>

      <div className="grid gap-4">
        {skills.map((skill) => <SkillCard key={skill.skillKey} skill={skill} />)}
      </div>

      <p className="px-1 text-xs leading-5 text-slate-600">
        This Character surface is reconstructable from governed evidence. It does not claim to measure your worth, complete ability, or everything you have done outside Wayfinder.
      </p>
    </div>
  );
}
