import type {
  InformationNeed,
  KnowledgeResolution,
  QuestionMode,
  QuestionOpportunity
} from "./contracts.ts";
import { InformationResolutionRouter } from "./acquisition-router.ts";
import { KnowledgeProviderRegistry } from "./knowledge-registry.ts";
import { KnowledgeRouter } from "./knowledge-router.ts";
import { QuestionPlanner } from "./question-planner.ts";
import {
  createOpenMeteoGeocodingProvider,
  createResolvedPlaceTimezoneProvider,
  type GeoPlaceCandidate
} from "./geo-open-meteo.ts";
import {
  createIntlLocalInstantProvider,
  type ResolvedLocalInstant
} from "./local-time-resolver.ts";

export type NatalReadinessStatus =
  | "NO_PERSON"
  | "MISSING_BIRTH_DATE"
  | "MISSING_BIRTH_PLACE"
  | "AMBIGUOUS_BIRTH_PLACE"
  | "PLACE_RESOLUTION_UNAVAILABLE"
  | "TIMEZONE_RESOLUTION_UNAVAILABLE"
  | "READY_FOR_TIME_INDEPENDENT_CHART_ONLY"
  | "AMBIGUOUS_BIRTH_INSTANT"
  | "BIRTH_INSTANT_UNRESOLVABLE"
  | "READY";

export interface PersonBirthFacts {
  personId?: string;
  personVersionId?: string;
  displayName?: string;
  birthDate?: string | null;
  birthTimeLocal?: string | null;
  birthTimeAccuracy?: "EXACT" | "APPROXIMATE" | null;
  birthPlaceLabel?: string | null;
}

export interface ResolveBirthContextRequest {
  person: PersonBirthFacts | null;
  now: string;
  locale?: string;
  purpose?: "NATAL_READINESS" | "FULL_NATAL_CHART";
  questionMode?: QuestionMode;
  selectedPlaceId?: string;
  includeOptionalQuestions?: boolean;
}

export interface BirthContextResolution {
  projectionType: "birth_context";
  ruleVersion: "birth_context_v0.1";
  evaluatedAt: string;
  readiness: NatalReadinessStatus;
  birthFacts: PersonBirthFacts | null;
  resolvedPlace?: GeoPlaceCandidate;
  placeCandidates?: GeoPlaceCandidate[];
  timeZone?: string;
  resolvedBirthInstant?: ResolvedLocalInstant;
  birthInstantCandidates?: ResolvedLocalInstant[];
  informationNeeds: InformationNeed[];
  questionOpportunities: QuestionOpportunity[];
  knowledgeLineage: Array<KnowledgeResolution<unknown>>;
  limitations: string[];
}

export interface BirthContextRuntimeOptions {
  fetchImpl?: typeof fetch;
}

function baseNeed(
  input: Omit<InformationNeed, "needId"> & { needId?: string }
): InformationNeed {
  return {
    ...input,
    needId: input.needId ?? `${input.concept}:${crypto.randomUUID()}`
  };
}

function createQuestionPlanner() {
  return new QuestionPlanner()
    .registerSpec({
      concept: "person.birth_date",
      questionKey: "person.birth_date.v1",
      questionIntent: "Ask for the player's birth date.",
      expectedAnswerShape: "calendar date",
      whyThisMatters: "A birth date is required before Wayfinder can calculate natal planetary geometry.",
      mayPersistAnswer: true,
      requiresExplicitAuthorizationForWrite: true
    })
    .registerSpec({
      concept: "person.birth_place",
      questionKey: "person.birth_place.v1",
      questionIntent: "Ask where the player was born, using city/region/country detail when known.",
      expectedAnswerShape: "birthplace label",
      whyThisMatters: "Birthplace is needed to resolve geographic coordinates and timezone context for a timed natal chart.",
      mayPersistAnswer: true,
      requiresExplicitAuthorizationForWrite: true
    })
    .registerSpec({
      concept: "person.birth_place_disambiguation",
      questionKey: "person.birth_place_disambiguation.v1",
      questionIntent: "Ask the player to identify which resolved birthplace candidate they mean.",
      expectedAnswerShape: "one candidate place selection",
      whyThisMatters: "More than one geographic place matches the recorded birthplace, and Wayfinder should not guess which one is correct.",
      mayPersistAnswer: true,
      requiresExplicitAuthorizationForWrite: true
    })
    .registerSpec({
      concept: "person.birth_time",
      questionKey: "person.birth_time.v1",
      questionIntent: "Ask for the player's birth time, while allowing them to say that it is unknown or approximate.",
      expectedAnswerShape: "local time, approximate time, or unknown",
      whyThisMatters: "Birth time is required for a fully timed natal chart including Ascendant and houses.",
      mayPersistAnswer: true,
      requiresExplicitAuthorizationForWrite: true
    });
}

function planQuestions(
  planner: QuestionPlanner,
  needs: readonly InformationNeed[],
  request: ResolveBirthContextRequest
) {
  return planner.plan(needs, {
    mode: request.questionMode ?? "TASK_DRIVEN",
    now: request.now,
    budget: request.questionMode === "DISCOVERY_SESSION" ? 3 : 1,
    includeOptional: request.includeOptionalQuestions ?? false,
    allowHighSensitivity: false
  });
}

function needsFullTimedChart(request: ResolveBirthContextRequest) {
  return request.purpose === "FULL_NATAL_CHART";
}

export function createBirthContextRuntime(options: BirthContextRuntimeOptions = {}) {
  const registry = new KnowledgeProviderRegistry()
    .register(createOpenMeteoGeocodingProvider({ fetchImpl: options.fetchImpl }))
    .register(createResolvedPlaceTimezoneProvider())
    .register(createIntlLocalInstantProvider());

  const knowledgeRouter = new KnowledgeRouter(registry);
  const acquisitionRouter = new InformationResolutionRouter(knowledgeRouter);
  const questionPlanner = createQuestionPlanner();

  return {
    registry,
    knowledgeRouter,
    acquisitionRouter,
    questionPlanner,
    async resolve(request: ResolveBirthContextRequest): Promise<BirthContextResolution> {
      const needs: InformationNeed[] = [];
      const knowledgeLineage: Array<KnowledgeResolution<unknown>> = [];
      const limitations: string[] = [];
      const person = request.person;

      const base: Omit<BirthContextResolution, "readiness"> = {
        projectionType: "birth_context",
        ruleVersion: "birth_context_v0.1",
        evaluatedAt: request.now,
        birthFacts: person,
        informationNeeds: needs,
        questionOpportunities: [],
        knowledgeLineage,
        limitations
      };

      if (!person) {
        limitations.push("No canonical Person record exists for the authenticated owner.");
        return { ...base, readiness: "NO_PERSON" };
      }

      if (!person.birthDate) {
        needs.push(
          baseNeed({
            concept: "person.birth_date",
            kind: "MISSING",
            purpose: "Resolve natal chart inputs.",
            consumers: ["astrology.natal_readiness", "astrology.natal_chart"],
            priorityClass: needsFullTimedChart(request) ? "P0_BLOCKING" : "P2_HIGH_LEVERAGE",
            resolutionOptions: ["PLAYER", "PRESERVE_UNKNOWN"],
            canonicalDestination: { module: "person", commandType: "person.update_profile" },
            expectedLifetime: "STABLE",
            sensitivity: "LOW",
            answerability: "HIGH",
            questionSignals: {
              uncertaintyReduction: 1,
              currentRelevance: needsFullTimedChart(request) ? 1 : 0.4,
              decisionImpact: needsFullTimedChart(request) ? 1 : 0.4,
              futureReuse: 1,
              userBurden: 0.15,
              interruptionCost: 0.15
            }
          })
        );
        return {
          ...base,
          readiness: "MISSING_BIRTH_DATE",
          questionOpportunities: planQuestions(questionPlanner, needs, request)
        };
      }

      if (!person.birthPlaceLabel?.trim()) {
        needs.push(
          baseNeed({
            concept: "person.birth_place",
            kind: "MISSING",
            purpose: "Resolve geographic and timezone context for natal calculation.",
            consumers: ["astrology.natal_readiness", "astrology.natal_chart"],
            priorityClass: needsFullTimedChart(request) ? "P0_BLOCKING" : "P2_HIGH_LEVERAGE",
            resolutionOptions: ["PLAYER", "PRESERVE_UNKNOWN"],
            canonicalDestination: { module: "person", commandType: "person.update_profile" },
            expectedLifetime: "STABLE",
            sensitivity: "LOW",
            answerability: "HIGH",
            questionSignals: {
              uncertaintyReduction: 1,
              currentRelevance: needsFullTimedChart(request) ? 1 : 0.4,
              decisionImpact: needsFullTimedChart(request) ? 1 : 0.4,
              futureReuse: 1,
              userBurden: 0.15,
              interruptionCost: 0.15
            }
          })
        );
        return {
          ...base,
          readiness: "MISSING_BIRTH_PLACE",
          questionOpportunities: planQuestions(questionPlanner, needs, request)
        };
      }

      const placeNeed = baseNeed({
        concept: "person.birth_place_resolution",
        kind: "MISSING",
        purpose: "Resolve the player's recorded birthplace label to a geographic place.",
        consumers: ["astrology.natal_readiness", "astrology.natal_chart"],
        priorityClass: needsFullTimedChart(request) ? "P0_BLOCKING" : "P1_HIGH_IMPACT",
        resolutionOptions: ["REFERENCE_DATA", "PLAYER", "PRESERVE_UNKNOWN"],
        expectedLifetime: "STABLE",
        sensitivity: "LOW",
        answerability: "HIGH"
      });

      const placeResult = await acquisitionRouter.resolve<GeoPlaceCandidate>(
        {
          need: placeNeed,
          knowledgeQueries: {
            REFERENCE_DATA: {
              requestId: crypto.randomUUID(),
              capability: "geo.resolve_place",
              domain: "geography",
              input: {
                name: person.birthPlaceLabel,
                count: 8,
                language: request.locale ?? "en"
              },
              locale: request.locale ?? "en",
              purpose: "Resolve canonical birthplace label for natal readiness."
            }
          }
        },
        { now: request.now }
      );

      if (placeResult.knowledge) knowledgeLineage.push(placeResult.knowledge);

      let place: GeoPlaceCandidate | undefined;
      if (placeResult.status === "RESOLVED") {
        place = placeResult.value;
      } else if (placeResult.status === "AMBIGUOUS") {
        const candidates = placeResult.candidates ?? [];
        const selected = request.selectedPlaceId
          ? candidates.find((candidate) => candidate.providerPlaceId === request.selectedPlaceId)
          : undefined;

        if (selected) {
          place = selected;
          limitations.push(
            "Birthplace ambiguity was resolved for this request by explicit candidate selection; the canonical Person birthplace label has not been rewritten by this read-only operation."
          );
        } else {
          const disambiguationNeed = baseNeed({
            concept: "person.birth_place_disambiguation",
            kind: "AMBIGUOUS",
            purpose: "Choose the intended birthplace without guessing among plausible geographic matches.",
            consumers: ["astrology.natal_readiness", "astrology.natal_chart"],
            priorityClass: needsFullTimedChart(request) ? "P0_BLOCKING" : "P1_HIGH_IMPACT",
            resolutionOptions: ["PLAYER", "PRESERVE_UNKNOWN"],
            canonicalDestination: { module: "person", commandType: "person.update_profile" },
            expectedLifetime: "STABLE",
            sensitivity: "LOW",
            answerability: "HIGH",
            evidence: { candidates },
            questionSignals: {
              uncertaintyReduction: 1,
              currentRelevance: 1,
              decisionImpact: 1,
              futureReuse: 1,
              userBurden: 0.1,
              interruptionCost: 0.1,
              conflictResolutionValue: 1
            }
          });
          needs.push(disambiguationNeed);
          return {
            ...base,
            readiness: "AMBIGUOUS_BIRTH_PLACE",
            placeCandidates: candidates,
            questionOpportunities: planQuestions(questionPlanner, needs, request)
          };
        }
      } else {
        limitations.push(placeResult.limitation ?? "Birthplace could not be resolved by the configured reference provider.");
        return {
          ...base,
          readiness: "PLACE_RESOLUTION_UNAVAILABLE"
        };
      }

      const timezoneNeed = baseNeed({
        concept: "person.birth_timezone_resolution",
        kind: "MISSING",
        purpose: "Resolve the IANA timezone associated with the selected birthplace.",
        consumers: ["astrology.natal_readiness", "astrology.natal_chart"],
        priorityClass: "P0_BLOCKING",
        resolutionOptions: ["REFERENCE_DATA", "PRESERVE_UNKNOWN"],
        expectedLifetime: "STABLE",
        sensitivity: "LOW",
        answerability: "LOW"
      });

      const timezoneResult = await acquisitionRouter.resolve<{ timeZone: string }>(
        {
          need: timezoneNeed,
          knowledgeQueries: {
            REFERENCE_DATA: {
              requestId: crypto.randomUUID(),
              capability: "geo.resolve_timezone",
              domain: "geography",
              input: { place },
              purpose: "Resolve birthplace timezone for local birth-time conversion."
            }
          }
        },
        { now: request.now }
      );

      if (timezoneResult.knowledge) knowledgeLineage.push(timezoneResult.knowledge);
      if (timezoneResult.status !== "RESOLVED" || !timezoneResult.value?.timeZone) {
        limitations.push(timezoneResult.limitation ?? "Birthplace timezone could not be resolved.");
        return {
          ...base,
          readiness: "TIMEZONE_RESOLUTION_UNAVAILABLE",
          resolvedPlace: place
        };
      }

      const timeZone = timezoneResult.value.timeZone;

      if (!person.birthTimeLocal) {
        const birthTimeNeed = baseNeed({
          concept: "person.birth_time",
          kind: "MISSING",
          purpose: "Resolve timed natal components such as Ascendant and houses.",
          consumers: ["astrology.natal_readiness", "astrology.natal_chart"],
          priorityClass: needsFullTimedChart(request) ? "P0_BLOCKING" : "P2_HIGH_LEVERAGE",
          resolutionOptions: ["PLAYER", "PRESERVE_UNKNOWN"],
          canonicalDestination: { module: "person", commandType: "person.update_profile" },
          expectedLifetime: "STABLE",
          sensitivity: "LOW",
          answerability: "MEDIUM",
          questionSignals: {
            uncertaintyReduction: 1,
            currentRelevance: needsFullTimedChart(request) ? 1 : 0.35,
            decisionImpact: needsFullTimedChart(request) ? 1 : 0.35,
            futureReuse: 1,
            userBurden: 0.2,
            interruptionCost: 0.2
          }
        });
        needs.push(birthTimeNeed);
        limitations.push(
          "Birth time is unknown. Wayfinder may later support date-only or bounded calculations, but it must not fabricate a time for Ascendant or houses."
        );
        return {
          ...base,
          readiness: "READY_FOR_TIME_INDEPENDENT_CHART_ONLY",
          resolvedPlace: place,
          timeZone,
          questionOpportunities: planQuestions(questionPlanner, needs, request)
        };
      }

      const instantNeed = baseNeed({
        concept: "person.birth_instant_resolution",
        kind: "MISSING",
        purpose: "Convert the player's recorded local birth date/time into a UTC instant.",
        consumers: ["astrology.natal_readiness", "astrology.natal_chart"],
        priorityClass: "P0_BLOCKING",
        resolutionOptions: ["DETERMINISTIC", "PRESERVE_UNKNOWN"],
        expectedLifetime: "STABLE",
        sensitivity: "LOW",
        answerability: "LOW"
      });

      const instantResult = await acquisitionRouter.resolve<ResolvedLocalInstant>(
        {
          need: instantNeed,
          knowledgeQueries: {
            DETERMINISTIC: {
              requestId: crypto.randomUUID(),
              capability: "time.resolve_local_instant",
              domain: "time",
              input: {
                localDate: person.birthDate,
                localTime: person.birthTimeLocal,
                timeZone
              },
              purpose: "Resolve UTC birth instant for deterministic natal geometry."
            }
          }
        },
        { now: request.now }
      );

      if (instantResult.knowledge) knowledgeLineage.push(instantResult.knowledge);

      if (instantResult.status === "AMBIGUOUS") {
        limitations.push(
          instantResult.limitation ?? "The recorded local birth time maps to multiple UTC instants."
        );
        return {
          ...base,
          readiness: "AMBIGUOUS_BIRTH_INSTANT",
          resolvedPlace: place,
          timeZone,
          birthInstantCandidates: instantResult.candidates
        };
      }

      if (instantResult.status !== "RESOLVED" || !instantResult.value) {
        limitations.push(
          instantResult.limitation ?? "The recorded birth date/time could not be converted to a UTC instant."
        );
        return {
          ...base,
          readiness: "BIRTH_INSTANT_UNRESOLVABLE",
          resolvedPlace: place,
          timeZone
        };
      }

      if (person.birthTimeAccuracy === "APPROXIMATE") {
        limitations.push(
          "Birth time is recorded as approximate. Timed chart geometry can be calculated, but Ascendant/house interpretation should preserve that uncertainty."
        );
      }
      limitations.push(
        "v0.1 local-time conversion uses the runtime Intl timezone database. Before persisting natal geometry as reproducible output, Wayfinder should pin/version the timezone rules used by the calculator."
      );

      return {
        ...base,
        readiness: "READY",
        resolvedPlace: place,
        timeZone,
        resolvedBirthInstant: instantResult.value,
        questionOpportunities: planQuestions(questionPlanner, needs, request)
      };
    }
  };
}
