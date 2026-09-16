import * as Astronomy from "npm:astronomy-engine@2.1.19";
import type { KnowledgeProvider, KnowledgeResolution } from "./contracts.ts";

export type NatalBodyId =
  | "SUN"
  | "MOON"
  | "MERCURY"
  | "VENUS"
  | "MARS"
  | "JUPITER"
  | "SATURN"
  | "URANUS"
  | "NEPTUNE"
  | "PLUTO";

export type ZodiacSign =
  | "ARIES"
  | "TAURUS"
  | "GEMINI"
  | "CANCER"
  | "LEO"
  | "VIRGO"
  | "LIBRA"
  | "SCORPIO"
  | "SAGITTARIUS"
  | "CAPRICORN"
  | "AQUARIUS"
  | "PISCES";

export type MotionState = "DIRECT" | "RETROGRADE" | "STATIONARY";
export type SupportedHouseSystem = "EQUAL" | "WHOLE_SIGN";

export interface NatalGeometryInput {
  utcInstant: string;
  latitude: number;
  longitude: number;
  placeRef?: {
    providerId?: string;
    providerPlaceId?: string;
    label?: string;
  };
}

export interface ZodiacPosition {
  longitude: number;
  sign: ZodiacSign;
  signIndex: number;
  degreeInSign: number;
}

export interface NatalBodyGeometry extends ZodiacPosition {
  id: NatalBodyId;
  label: string;
  latitude: number;
  distanceAu: number;
  longitudeSpeedDegPerDayApprox: number;
  motion: MotionState;
}

export interface NatalAngleGeometry extends ZodiacPosition {
  id: "ASC" | "MC" | "DESC" | "IC";
  label: string;
}

export interface HouseCusp extends ZodiacPosition {
  house: number;
}

export interface HousePlacement {
  pointId: NatalBodyId;
  house: number;
}

export interface HouseSystemGeometry {
  system: SupportedHouseSystem;
  methodVersion: string;
  cusps: HouseCusp[];
  bodyPlacements: HousePlacement[];
}

export interface NearestMajorAspect {
  name: "CONJUNCTION" | "SEXTILE" | "SQUARE" | "TRINE" | "OPPOSITION";
  exactAngle: number;
  orb: number;
}

export interface AngularRelationship {
  from: NatalBodyId | "ASC" | "MC";
  to: NatalBodyId | "ASC" | "MC";
  separation: number;
  nearestMajorAspect: NearestMajorAspect;
}

export interface NatalGeometry {
  projectionType: "natal_geometry";
  ruleVersion: "natal_geometry_v0.1";
  calculatedAt: string;
  input: NatalGeometryInput;
  frame: {
    zodiac: "TROPICAL";
    planetaryObserver: "GEOCENTRIC";
    ecliptic: "TRUE_ECLIPTIC_OF_DATE";
    aberration: true;
  };
  engine: {
    id: "astronomy-engine";
    version: "2.1.19";
    license: "MIT";
    motionMethod: "CENTRAL_DIFFERENCE_12H";
  };
  sidereal: {
    greenwichApparentSiderealTimeHours: number;
    localApparentSiderealTimeDegrees: number;
    trueObliquityDegrees: number;
  };
  bodies: NatalBodyGeometry[];
  angles?: {
    ascendant: NatalAngleGeometry;
    midheaven: NatalAngleGeometry;
    descendant: NatalAngleGeometry;
    imumCoeli: NatalAngleGeometry;
  };
  houseSystems: HouseSystemGeometry[];
  angularRelationships: AngularRelationship[];
  limitations: string[];
}

const SIGNS: ZodiacSign[] = [
  "ARIES",
  "TAURUS",
  "GEMINI",
  "CANCER",
  "LEO",
  "VIRGO",
  "LIBRA",
  "SCORPIO",
  "SAGITTARIUS",
  "CAPRICORN",
  "AQUARIUS",
  "PISCES"
];

const BODIES: Array<{ id: NatalBodyId; label: string; body: Astronomy.Body }> = [
  { id: "SUN", label: "Sun", body: Astronomy.Body.Sun },
  { id: "MOON", label: "Moon", body: Astronomy.Body.Moon },
  { id: "MERCURY", label: "Mercury", body: Astronomy.Body.Mercury },
  { id: "VENUS", label: "Venus", body: Astronomy.Body.Venus },
  { id: "MARS", label: "Mars", body: Astronomy.Body.Mars },
  { id: "JUPITER", label: "Jupiter", body: Astronomy.Body.Jupiter },
  { id: "SATURN", label: "Saturn", body: Astronomy.Body.Saturn },
  { id: "URANUS", label: "Uranus", body: Astronomy.Body.Uranus },
  { id: "NEPTUNE", label: "Neptune", body: Astronomy.Body.Neptune },
  { id: "PLUTO", label: "Pluto", body: Astronomy.Body.Pluto }
];

const MAJOR_ASPECTS: Array<{
  name: NearestMajorAspect["name"];
  exactAngle: number;
}> = [
  { name: "CONJUNCTION", exactAngle: 0 },
  { name: "SEXTILE", exactAngle: 60 },
  { name: "SQUARE", exactAngle: 90 },
  { name: "TRINE", exactAngle: 120 },
  { name: "OPPOSITION", exactAngle: 180 }
];

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function normalizeDegrees(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function signedDeltaDegrees(from: number, to: number) {
  return ((to - from + 540) % 360) - 180;
}

function zodiacPosition(longitude: number): ZodiacPosition {
  const normalized = normalizeDegrees(longitude);
  const signIndex = Math.floor(normalized / 30) % 12;
  return {
    longitude: normalized,
    sign: SIGNS[signIndex],
    signIndex,
    degreeInSign: normalized - signIndex * 30
  };
}

function eclipticPosition(body: Astronomy.Body, date: Date) {
  const vector = Astronomy.GeoVector(body, date, true);
  const ecliptic = Astronomy.Ecliptic(vector);
  const distanceAu = Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
  return {
    longitude: normalizeDegrees(ecliptic.elon),
    latitude: ecliptic.elat,
    distanceAu
  };
}

function approximateLongitudeSpeed(body: Astronomy.Body, date: Date) {
  const sixHoursMs = 6 * 60 * 60 * 1000;
  const previous = eclipticPosition(body, new Date(date.getTime() - sixHoursMs)).longitude;
  const next = eclipticPosition(body, new Date(date.getTime() + sixHoursMs)).longitude;
  const deltaAcrossHalfDay = signedDeltaDegrees(previous, next);
  return deltaAcrossHalfDay / 0.5;
}

function motionFromSpeed(speed: number): MotionState {
  if (Math.abs(speed) < 1e-6) return "STATIONARY";
  return speed < 0 ? "RETROGRADE" : "DIRECT";
}

function calculateAngles(
  localSiderealDegrees: number,
  trueObliquityDegrees: number,
  latitude: number
) {
  if (Math.abs(latitude) >= 90) return null;

  const theta = localSiderealDegrees * DEG;
  const epsilon = trueObliquityDegrees * DEG;
  const phi = latitude * DEG;

  const ascendant = normalizeDegrees(
    Math.atan2(
      Math.cos(theta),
      -(
        Math.sin(theta) * Math.cos(epsilon) +
        Math.tan(phi) * Math.sin(epsilon)
      )
    ) * RAD
  );

  const midheaven = normalizeDegrees(
    Math.atan2(
      Math.sin(theta),
      Math.cos(theta) * Math.cos(epsilon)
    ) * RAD
  );

  return {
    ascendant,
    midheaven,
    descendant: normalizeDegrees(ascendant + 180),
    imumCoeli: normalizeDegrees(midheaven + 180)
  };
}

function angleGeometry(
  id: NatalAngleGeometry["id"],
  label: string,
  longitude: number
): NatalAngleGeometry {
  return {
    id,
    label,
    ...zodiacPosition(longitude)
  };
}

function equalHouseGeometry(ascendant: number, bodies: NatalBodyGeometry[]): HouseSystemGeometry {
  const cusps = Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    ...zodiacPosition(ascendant + index * 30)
  }));

  const bodyPlacements = bodies.map((body) => ({
    pointId: body.id,
    house: Math.floor(normalizeDegrees(body.longitude - ascendant) / 30) + 1
  }));

  return {
    system: "EQUAL",
    methodVersion: "equal-from-ascendant-v1",
    cusps,
    bodyPlacements
  };
}

function wholeSignHouseGeometry(ascendant: number, bodies: NatalBodyGeometry[]): HouseSystemGeometry {
  const firstSignIndex = Math.floor(normalizeDegrees(ascendant) / 30);
  const firstCusp = firstSignIndex * 30;
  const cusps = Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    ...zodiacPosition(firstCusp + index * 30)
  }));

  const bodyPlacements = bodies.map((body) => {
    const bodySign = Math.floor(normalizeDegrees(body.longitude) / 30);
    return {
      pointId: body.id,
      house: ((bodySign - firstSignIndex + 12) % 12) + 1
    };
  });

  return {
    system: "WHOLE_SIGN",
    methodVersion: "whole-sign-v1",
    cusps,
    bodyPlacements
  };
}

function nearestMajorAspect(separation: number): NearestMajorAspect {
  return MAJOR_ASPECTS
    .map((aspect) => ({
      ...aspect,
      orb: Math.abs(separation - aspect.exactAngle)
    }))
    .sort((a, b) => a.orb - b.orb || a.exactAngle - b.exactAngle)[0];
}

function calculateRelationships(
  bodies: NatalBodyGeometry[],
  angles: NatalGeometry["angles"]
): AngularRelationship[] {
  const points: Array<{ id: AngularRelationship["from"]; longitude: number }> = bodies.map(
    (body) => ({ id: body.id, longitude: body.longitude })
  );

  if (angles) {
    points.push(
      { id: "ASC", longitude: angles.ascendant.longitude },
      { id: "MC", longitude: angles.midheaven.longitude }
    );
  }

  const relationships: AngularRelationship[] = [];
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const raw = Math.abs(signedDeltaDegrees(points[i].longitude, points[j].longitude));
      const separation = Math.min(raw, 360 - raw);
      relationships.push({
        from: points[i].id,
        to: points[j].id,
        separation,
        nearestMajorAspect: nearestMajorAspect(separation)
      });
    }
  }
  return relationships;
}

export function calculateNatalGeometry(
  input: NatalGeometryInput,
  calculatedAt = new Date().toISOString()
): NatalGeometry {
  const instant = new Date(input.utcInstant);
  if (!Number.isFinite(instant.getTime())) throw new Error("NATAL_GEOMETRY_INVALID_INSTANT");
  if (!Number.isFinite(input.latitude) || input.latitude < -90 || input.latitude > 90) {
    throw new Error("NATAL_GEOMETRY_INVALID_LATITUDE");
  }
  if (!Number.isFinite(input.longitude) || input.longitude < -180 || input.longitude > 180) {
    throw new Error("NATAL_GEOMETRY_INVALID_LONGITUDE");
  }

  const astroTime = Astronomy.MakeTime(instant);
  const greenwichSiderealHours = Astronomy.SiderealTime(astroTime);
  const localSiderealDegrees = normalizeDegrees(
    greenwichSiderealHours * 15 + input.longitude
  );
  const tilt = Astronomy.e_tilt(astroTime);
  const trueObliquityDegrees = tilt.tobl;

  const bodies: NatalBodyGeometry[] = BODIES.map(({ id, label, body }) => {
    const position = eclipticPosition(body, instant);
    const speed = approximateLongitudeSpeed(body, instant);
    return {
      id,
      label,
      ...zodiacPosition(position.longitude),
      latitude: position.latitude,
      distanceAu: position.distanceAu,
      longitudeSpeedDegPerDayApprox: speed,
      motion: motionFromSpeed(speed)
    };
  });

  const limitations: string[] = [
    "v0.1 calculates geocentric tropical true-ecliptic-of-date geometry only; it does not provide symbolic interpretation.",
    "Longitude speed is a deterministic central-difference approximation across twelve hours rather than a native ephemeris velocity output.",
    "Aspect output reports exact angular separation and the nearest major aspect angle only; it does not decide whether an aspect is active under any orb convention.",
    "v0.1 exposes Equal and Whole Sign house geometry. It intentionally does not implement Placidus/Koch until a separately validated and license-compatible house provider is admitted."
  ];

  const rawAngles = calculateAngles(localSiderealDegrees, trueObliquityDegrees, input.latitude);
  let angles: NatalGeometry["angles"];
  let houseSystems: HouseSystemGeometry[] = [];

  if (rawAngles) {
    angles = {
      ascendant: angleGeometry("ASC", "Ascendant", rawAngles.ascendant),
      midheaven: angleGeometry("MC", "Midheaven", rawAngles.midheaven),
      descendant: angleGeometry("DESC", "Descendant", rawAngles.descendant),
      imumCoeli: angleGeometry("IC", "Imum Coeli", rawAngles.imumCoeli)
    };
    houseSystems = [
      equalHouseGeometry(rawAngles.ascendant, bodies),
      wholeSignHouseGeometry(rawAngles.ascendant, bodies)
    ];
  } else {
    limitations.push(
      "Ascendant and house geometry are undefined at the geographic poles, so only planetary geometry is returned."
    );
  }

  return {
    projectionType: "natal_geometry",
    ruleVersion: "natal_geometry_v0.1",
    calculatedAt,
    input,
    frame: {
      zodiac: "TROPICAL",
      planetaryObserver: "GEOCENTRIC",
      ecliptic: "TRUE_ECLIPTIC_OF_DATE",
      aberration: true
    },
    engine: {
      id: "astronomy-engine",
      version: "2.1.19",
      license: "MIT",
      motionMethod: "CENTRAL_DIFFERENCE_12H"
    },
    sidereal: {
      greenwichApparentSiderealTimeHours: greenwichSiderealHours,
      localApparentSiderealTimeDegrees: localSiderealDegrees,
      trueObliquityDegrees
    },
    bodies,
    angles,
    houseSystems,
    angularRelationships: calculateRelationships(bodies, angles),
    limitations
  };
}

export function createAstronomyEngineNatalGeometryProvider(): KnowledgeProvider {
  const version = "natal-geometry-astronomy-engine-v0.1";
  return {
    id: "astro.astronomy_engine",
    version,
    sourceClass: "DETERMINISTIC",
    capabilities: ["astro.natal_geometry"],
    priority: 50,
    readiness: () => ({ status: "READY" }),
    resolve(query, context): KnowledgeResolution<NatalGeometry> {
      if (query.capability !== "astro.natal_geometry") {
        return {
          status: "NOT_APPLICABLE",
          capability: query.capability,
          providerId: "astro.astronomy_engine",
          providerVersion: version,
          sourceClass: "DETERMINISTIC"
        };
      }

      try {
        const input = query.input as NatalGeometryInput;
        const value = calculateNatalGeometry(input, context.now);
        const partial = value.angles == null;
        return {
          status: partial ? "PARTIAL" : "RESOLVED",
          capability: query.capability,
          providerId: "astro.astronomy_engine",
          providerVersion: version,
          sourceClass: "DETERMINISTIC",
          value,
          sourceId: "astronomy-engine",
          sourceVersion: "2.1.19",
          effectiveAt: input.utcInstant,
          retrievedAt: context.now,
          authority: "HIGH",
          confidence: partial ? 0.95 : 1,
          lineage: {
            utcInstant: input.utcInstant,
            latitude: input.latitude,
            longitude: input.longitude,
            placeRef: input.placeRef,
            coordinateFrame: value.frame,
            algorithm: value.engine
          },
          limitation: partial
            ? "Planetary geometry resolved, but terrestrial angle/house geometry is not available for this latitude."
            : undefined
        };
      } catch (error) {
        return {
          status: "CONFLICTING",
          capability: query.capability,
          providerId: "astro.astronomy_engine",
          providerVersion: version,
          sourceClass: "DETERMINISTIC",
          limitation: error instanceof Error ? error.message : "Natal geometry calculation failed."
        };
      }
    }
  };
}
