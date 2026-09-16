import {
  calculateNatalGeometry,
  createAstronomyEngineNatalGeometryProvider
} from "../supabase/functions/_shared/intelligence/natal-geometry.ts";
import { createNatalGeometryRuntime } from "../supabase/functions/_shared/intelligence/natal-geometry-service.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${message}`);
}

function assertNear(actual: number, expected: number, tolerance: number, label: string) {
  const delta = Math.abs(actual - expected);
  const circularDelta = Math.min(delta, Math.abs(delta - 360));
  if (circularDelta > tolerance) {
    throw new Error(
      `ASSERTION_FAILED:${label}: expected ${expected} +/- ${tolerance}, got ${actual} (delta ${circularDelta})`
    );
  }
}

function body(chart: ReturnType<typeof calculateNatalGeometry>, id: string) {
  const found = chart.bodies.find((item) => item.id === id);
  if (!found) throw new Error(`ASSERTION_FAILED:missing body ${id}`);
  return found;
}

Deno.test("natal geometry matches independent Swiss Ephemeris reference within bounded tolerance", () => {
  // Neutral public-style fixture: 1990-05-15 14:30 UTC, Ankara-area coordinates.
  // Expected values below were generated independently with Swiss Ephemeris and are not used by runtime code.
  const chart = calculateNatalGeometry(
    {
      utcInstant: "1990-05-15T14:30:00.000Z",
      latitude: 39.93,
      longitude: 32.86
    },
    "2026-09-16T03:00:00.000Z"
  );

  assertNear(body(chart, "SUN").longitude, 54.4965555, 0.05, "Sun longitude");
  assertNear(body(chart, "MOON").longitude, 298.4500716, 0.08, "Moon longitude");
  assertNear(body(chart, "MERCURY").longitude, 38.0003387, 0.05, "Mercury longitude");
  assertNear(body(chart, "VENUS").longitude, 12.9371424, 0.05, "Venus longitude");
  assertNear(body(chart, "MARS").longitude, 348.4112183, 0.05, "Mars longitude");
  assertNear(body(chart, "JUPITER").longitude, 99.5614066, 0.05, "Jupiter longitude");
  assertNear(body(chart, "SATURN").longitude, 295.2476749, 0.05, "Saturn longitude");
  assertNear(body(chart, "URANUS").longitude, 279.1813501, 0.05, "Uranus longitude");
  assertNear(body(chart, "NEPTUNE").longitude, 284.3513699, 0.05, "Neptune longitude");
  assertNear(body(chart, "PLUTO").longitude, 226.1645551, 0.08, "Pluto longitude");

  assert(chart.angles != null, "expected angles away from geographic pole");
  assertNear(chart.angles.ascendant.longitude, 206.6223871, 0.05, "Ascendant");
  assertNear(chart.angles.midheaven.longitude, 121.1902190, 0.05, "Midheaven");

  const equal = chart.houseSystems.find((item) => item.system === "EQUAL");
  const whole = chart.houseSystems.find((item) => item.system === "WHOLE_SIGN");
  assert(equal != null, "expected Equal house geometry");
  assert(whole != null, "expected Whole Sign house geometry");
  assertNear(equal.cusps[0].longitude, chart.angles.ascendant.longitude, 1e-9, "Equal first cusp");
  assertNear(equal.cusps[9].longitude, 116.6223871, 0.05, "Equal tenth cusp");
  assertNear(whole.cusps[0].longitude, 180, 1e-9, "Whole Sign first cusp");

  assert(body(chart, "MERCURY").motion === "RETROGRADE", "Mercury should be retrograde in reference fixture");
  assert(body(chart, "SATURN").motion === "RETROGRADE", "Saturn should be retrograde in reference fixture");
  assert(body(chart, "SUN").motion === "DIRECT", "Sun should be direct in reference fixture");

  // 10 bodies + ASC + MC = 12 points, choose 2 = 66 pairwise geometric relationships.
  assert(chart.angularRelationships.length === 66, "expected all pairwise body/angle separations");
  assert(
    chart.angularRelationships.every((item) => item.separation >= 0 && item.separation <= 180),
    "all angular separations must be bounded to [0,180]"
  );
});

Deno.test("aspect geometry reports nearest major angle without declaring an active symbolic aspect", () => {
  const chart = calculateNatalGeometry({
    utcInstant: "2000-01-01T12:00:00.000Z",
    latitude: 0,
    longitude: 0
  });

  const relationship = chart.angularRelationships[0];
  assert(relationship.nearestMajorAspect.orb >= 0, "nearest aspect should expose geometric orb distance");
  assert(
    !("active" in relationship.nearestMajorAspect),
    "geometry must not decide whether an aspect is active under an interpretive orb convention"
  );
});

Deno.test("geographic poles preserve planetary geometry but do not fabricate Ascendant/houses", () => {
  const chart = calculateNatalGeometry({
    utcInstant: "2000-01-01T12:00:00.000Z",
    latitude: 90,
    longitude: 0
  });

  assert(chart.bodies.length === 10, "planetary geometry should remain available");
  assert(chart.angles == null, "Ascendant must be omitted at exact pole");
  assert(chart.houseSystems.length === 0, "house geometry must be omitted without a valid Ascendant");
});

Deno.test("deterministic provider preserves calculation errors as conflict rather than invented geometry", async () => {
  const provider = createAstronomyEngineNatalGeometryProvider();
  const result = await provider.resolve(
    {
      requestId: "invalid-geometry",
      capability: "astro.natal_geometry",
      input: {
        utcInstant: "not-a-date",
        latitude: 0,
        longitude: 0
      }
    },
    { now: "2026-09-16T03:00:00.000Z" }
  );

  assert(result.status === "CONFLICTING", "invalid deterministic input must not return fabricated geometry");
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function mockGeoFetch(input: string | URL | Request) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url);
  const name = url.searchParams.get("name") ?? "";
  if (name === "Test Meridian") {
    return Promise.resolve(
      jsonResponse({
        results: [
          {
            id: 1001,
            name: "Test Meridian",
            latitude: 0,
            longitude: 0,
            timezone: "UTC",
            country_code: "ZZ",
            country: "Test",
            feature_code: "PPL"
          }
        ]
      })
    );
  }
  return Promise.resolve(jsonResponse({ results: [] }));
}

Deno.test("full runtime composes Person birth facts, Knowledge resolution, time resolution, and natal geometry", async () => {
  const runtime = createNatalGeometryRuntime({ fetchImpl: mockGeoFetch as typeof fetch });
  const result = await runtime.resolve({
    now: "2026-09-16T03:00:00.000Z",
    questionMode: "TASK_DRIVEN",
    person: {
      personId: "person-test",
      personVersionId: "person-version-test",
      displayName: "Test Player",
      birthDate: "2000-01-01",
      birthTimeLocal: "12:00:00",
      birthTimeAccuracy: "EXACT",
      birthPlaceLabel: "Test Meridian"
    }
  });

  assert(result.readiness === "READY", `expected READY, got ${result.readiness}`);
  assert(result.birthContext.readiness === "READY", "birth context should resolve first");
  assert(result.geometry?.bodies.length === 10, "geometry should contain ten major bodies");
  assert(result.geometry?.engine.version === "2.1.19", "ephemeris implementation version should be explicit");
  assert(result.geometryKnowledge?.sourceClass === "DETERMINISTIC", "geometry must remain deterministic knowledge");
});
