import { createBirthContextRuntime } from "../supabase/functions/_shared/intelligence/birth-context-service.ts";
import { createIntlLocalInstantProvider } from "../supabase/functions/_shared/intelligence/local-time-resolver.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${message}`);
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const keyWest = {
  id: 4160812,
  name: "Key West",
  latitude: 24.5557,
  longitude: -81.7826,
  timezone: "America/New_York",
  country_code: "US",
  country: "United States",
  admin1: "Florida",
  feature_code: "PPLA2",
  population: 25000
};

const keyWestOther = {
  id: 999100,
  name: "Key West",
  latitude: 41.2,
  longitude: -93.1,
  timezone: "America/Chicago",
  country_code: "US",
  country: "United States",
  admin1: "Iowa",
  feature_code: "PPL"
};

const springfieldIllinois = {
  id: 4250542,
  name: "Springfield",
  latitude: 39.8017,
  longitude: -89.6437,
  timezone: "America/Chicago",
  country_code: "US",
  country: "United States",
  admin1: "Illinois",
  feature_code: "PPLA",
  population: 114000
};

const springfieldMassachusetts = {
  id: 4951788,
  name: "Springfield",
  latitude: 42.1015,
  longitude: -72.5898,
  timezone: "America/New_York",
  country_code: "US",
  country: "United States",
  admin1: "Massachusetts",
  feature_code: "PPLA",
  population: 155000
};

function mockGeoFetch(input: string | URL | Request) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
  const name = url.searchParams.get("name") ?? "";

  if (name === "Key West, FL") {
    return Promise.resolve(jsonResponse({ results: [keyWest, keyWestOther] }));
  }
  if (name === "Springfield") {
    return Promise.resolve(jsonResponse({ results: [springfieldIllinois, springfieldMassachusetts] }));
  }
  if (name === "Provider Down") {
    return Promise.reject(new Error("simulated provider outage"));
  }
  return Promise.resolve(jsonResponse({ results: [] }));
}

Deno.test("qualified birthplace resolves through Knowledge and historical local time resolves to UTC", async () => {
  const runtime = createBirthContextRuntime({ fetchImpl: mockGeoFetch as typeof fetch });
  const result = await runtime.resolve({
    now: "2026-09-16T02:00:00.000Z",
    purpose: "FULL_NATAL_CHART",
    questionMode: "TASK_DRIVEN",
    person: {
      personId: "person-1",
      personVersionId: "version-1",
      displayName: "Test Player",
      birthDate: "1988-10-22",
      birthTimeLocal: "17:32:00",
      birthTimeAccuracy: "EXACT",
      birthPlaceLabel: "Key West, FL"
    }
  });

  assert(result.readiness === "READY", `expected READY, got ${result.readiness}`);
  assert(result.resolvedPlace?.admin1 === "Florida", "expected Florida candidate");
  assert(result.timeZone === "America/New_York", "expected America/New_York timezone");
  assert(
    result.resolvedBirthInstant?.utcInstant === "1988-10-22T21:32:00.000Z",
    `unexpected UTC instant ${result.resolvedBirthInstant?.utcInstant}`
  );
  assert(result.knowledgeLineage.length === 3, "expected place, timezone, and local-instant lineage");
});

Deno.test("ambiguous birthplace stays ambiguous and becomes a prioritized player question", async () => {
  const runtime = createBirthContextRuntime({ fetchImpl: mockGeoFetch as typeof fetch });
  const result = await runtime.resolve({
    now: "2026-09-16T02:00:00.000Z",
    purpose: "FULL_NATAL_CHART",
    questionMode: "TASK_DRIVEN",
    person: {
      birthDate: "1990-01-01",
      birthTimeLocal: "12:00:00",
      birthTimeAccuracy: "EXACT",
      birthPlaceLabel: "Springfield"
    }
  });

  assert(result.readiness === "AMBIGUOUS_BIRTH_PLACE", "ambiguity must be preserved");
  assert((result.placeCandidates?.length ?? 0) >= 2, "expected multiple place candidates");
  assert(result.questionOpportunities.length === 1, "task-driven ambiguity should surface one question");
  assert(
    result.questionOpportunities[0].questionKey === "person.birth_place_disambiguation.v1",
    "expected birthplace disambiguation question"
  );
});

Deno.test("missing birth time does not nag in normal readiness but appears in Discovery Session", async () => {
  const runtime = createBirthContextRuntime({ fetchImpl: mockGeoFetch as typeof fetch });

  const normal = await runtime.resolve({
    now: "2026-09-16T02:00:00.000Z",
    purpose: "NATAL_READINESS",
    questionMode: "TASK_DRIVEN",
    person: {
      birthDate: "1988-10-22",
      birthPlaceLabel: "Key West, FL"
    }
  });
  assert(normal.readiness === "READY_FOR_TIME_INDEPENDENT_CHART_ONLY", "expected partial natal readiness");
  assert(normal.questionOpportunities.length === 0, "P2 birth-time discovery should not interrupt task-driven mode");

  const discovery = await runtime.resolve({
    now: "2026-09-16T02:00:00.000Z",
    purpose: "NATAL_READINESS",
    questionMode: "DISCOVERY_SESSION",
    person: {
      birthDate: "1988-10-22",
      birthPlaceLabel: "Key West, FL"
    }
  });
  assert(discovery.questionOpportunities.length === 1, "Discovery Session may ask the high-leverage birth-time question");
  assert(discovery.questionOpportunities[0].questionKey === "person.birth_time.v1", "expected birth-time question");
});

Deno.test("timezone clock fold is preserved as ambiguous rather than guessed", async () => {
  const provider = createIntlLocalInstantProvider();
  const result = await provider.resolve(
    {
      requestId: "dst-fold",
      capability: "time.resolve_local_instant",
      input: {
        localDate: "2026-11-01",
        localTime: "01:30:00",
        timeZone: "America/New_York"
      }
    },
    { now: "2026-09-16T02:00:00.000Z" }
  );

  assert(result.status === "AMBIGUOUS", `expected DST fold ambiguity, got ${result.status}`);
  assert(result.candidates?.length === 2, `expected two UTC instants, got ${result.candidates?.length}`);
});

Deno.test("reference-provider outage becomes unavailable and never fabricated", async () => {
  const runtime = createBirthContextRuntime({ fetchImpl: mockGeoFetch as typeof fetch });
  const result = await runtime.resolve({
    now: "2026-09-16T02:00:00.000Z",
    purpose: "FULL_NATAL_CHART",
    questionMode: "TASK_DRIVEN",
    person: {
      birthDate: "1988-10-22",
      birthTimeLocal: "17:32:00",
      birthPlaceLabel: "Provider Down"
    }
  });

  assert(result.readiness === "PLACE_RESOLUTION_UNAVAILABLE", "provider outage must remain unavailable");
  assert(result.resolvedPlace == null, "provider outage must not invent a place");
});
