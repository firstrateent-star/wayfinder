import type {
  KnowledgeProvider,
  KnowledgeQuery,
  KnowledgeResolution
} from "./contracts.ts";

export interface GeoPlaceCandidate {
  providerPlaceId: string;
  label: string;
  name: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  countryCode?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  featureCode?: string;
  population?: number;
}

export interface ResolvePlaceInput {
  name: string;
  count?: number;
  language?: string;
}

export interface ResolveTimezoneInput {
  place: GeoPlaceCandidate;
}

interface OpenMeteoPlace {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  country_code?: string;
  country?: string;
  admin1?: string;
  admin2?: string;
  feature_code?: string;
  population?: number;
}

interface OpenMeteoResponse {
  results?: OpenMeteoPlace[];
}

export interface OpenMeteoGeocodingOptions {
  fetchImpl?: typeof fetch;
  endpoint?: string;
  providerVersion?: string;
}

const DEFAULT_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";

function normalize(value: string | undefined) {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function makeLabel(place: OpenMeteoPlace) {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

function toCandidate(place: OpenMeteoPlace): GeoPlaceCandidate | null {
  if (
    place.id == null ||
    !place.name ||
    typeof place.latitude !== "number" ||
    typeof place.longitude !== "number"
  ) {
    return null;
  }

  return {
    providerPlaceId: String(place.id),
    label: makeLabel(place),
    name: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone,
    countryCode: place.country_code,
    country: place.country,
    admin1: place.admin1,
    admin2: place.admin2,
    featureCode: place.feature_code,
    population: place.population
  };
}

function placeScore(query: string, candidate: GeoPlaceCandidate) {
  const [namePart, ...qualifierParts] = query.split(",");
  const queryName = normalize(namePart);
  const qualifier = normalize(qualifierParts.join(" "));
  const candidateName = normalize(candidate.name);
  const candidateContext = normalize(
    [candidate.admin1, candidate.admin2, candidate.country, candidate.countryCode].filter(Boolean).join(" ")
  );

  let score = 0;
  if (candidateName === queryName) score += 30;
  else if (candidateName.startsWith(queryName) || queryName.startsWith(candidateName)) score += 16;
  else if (candidateName.includes(queryName) || queryName.includes(candidateName)) score += 8;

  if (qualifier) {
    if (candidateContext.includes(qualifier)) score += 14;
    else {
      const tokens = qualifier.split(" ").filter(Boolean);
      score += tokens.filter((token) => candidateContext.includes(token)).length * 4;
    }
  }

  if (candidate.featureCode?.startsWith("PPL")) score += 2;
  if (candidate.population && candidate.population > 0) {
    score += Math.min(3, Math.log10(candidate.population + 1) / 2);
  }
  return score;
}

function classifyCandidates(query: string, candidates: GeoPlaceCandidate[]) {
  if (candidates.length === 0) return { status: "UNKNOWN" as const };
  if (candidates.length === 1) {
    return { status: "RESOLVED" as const, value: candidates[0], confidence: 0.98 };
  }

  const ranked = candidates
    .map((candidate) => ({ candidate, score: placeScore(query, candidate) }))
    .sort((a, b) => b.score - a.score || a.candidate.label.localeCompare(b.candidate.label));

  const top = ranked[0];
  const second = ranked[1];
  const [namePart, ...qualifierParts] = query.split(",");
  const hasQualifier = normalize(qualifierParts.join(" ")).length > 0;
  const exactTopName = normalize(top.candidate.name) === normalize(namePart);
  const sameTopIdentity = ranked.filter(
    ({ candidate }) =>
      normalize(candidate.name) === normalize(top.candidate.name) &&
      normalize(candidate.admin1) === normalize(top.candidate.admin1) &&
      normalize(candidate.countryCode) === normalize(top.candidate.countryCode)
  );

  // A qualified exact-name result can be accepted when the provider did not
  // return another candidate with the same city/admin/country identity. The
  // provider itself applies the comma qualifier before result limiting.
  if (hasQualifier && exactTopName && sameTopIdentity.length === 1) {
    return { status: "RESOLVED" as const, value: top.candidate, confidence: 0.95 };
  }

  // For unqualified names, only accept a clear lexical/ranking separation.
  // Common place names such as Springfield should remain ambiguous.
  if (top.score - second.score >= 10 && exactTopName) {
    return { status: "RESOLVED" as const, value: top.candidate, confidence: 0.9 };
  }

  return {
    status: "AMBIGUOUS" as const,
    candidates: ranked.slice(0, 5).map((item) => item.candidate)
  };
}

export function createOpenMeteoGeocodingProvider(
  options: OpenMeteoGeocodingOptions = {}
): KnowledgeProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const version = options.providerVersion ?? "open-meteo-geocoding-v1";

  return {
    id: "geo.open_meteo",
    version,
    sourceClass: "REFERENCE_DATA",
    capabilities: ["geo.resolve_place"],
    priority: 50,
    readiness: () => ({ status: "READY" }),
    async resolve(query, context): Promise<KnowledgeResolution<GeoPlaceCandidate>> {
      if (query.capability !== "geo.resolve_place") {
        return {
          status: "NOT_APPLICABLE",
          capability: query.capability,
          providerId: "geo.open_meteo",
          providerVersion: version,
          sourceClass: "REFERENCE_DATA"
        };
      }

      const input = query.input as ResolvePlaceInput;
      const name = input?.name?.trim();
      if (!name) {
        return {
          status: "UNKNOWN",
          capability: query.capability,
          providerId: "geo.open_meteo",
          providerVersion: version,
          sourceClass: "REFERENCE_DATA",
          limitation: "Place label is required for geographic resolution."
        };
      }

      const url = new URL(endpoint);
      url.searchParams.set("name", name);
      url.searchParams.set("count", String(Math.max(1, Math.min(10, input.count ?? 8))));
      url.searchParams.set("language", (input.language ?? query.locale ?? "en").toLowerCase());
      url.searchParams.set("format", "json");

      let response: Response;
      try {
        response = await fetchImpl(url, { signal: context.signal });
      } catch (error) {
        return {
          status: "UNAVAILABLE",
          capability: query.capability,
          providerId: "geo.open_meteo",
          providerVersion: version,
          sourceClass: "REFERENCE_DATA",
          limitation: error instanceof Error ? error.message : "Geocoding provider request failed."
        };
      }

      if (!response.ok) {
        return {
          status: "UNAVAILABLE",
          capability: query.capability,
          providerId: "geo.open_meteo",
          providerVersion: version,
          sourceClass: "REFERENCE_DATA",
          limitation: `Geocoding provider returned HTTP ${response.status}.`
        };
      }

      const payload = (await response.json()) as OpenMeteoResponse;
      const candidates = (payload.results ?? [])
        .map(toCandidate)
        .filter((candidate): candidate is GeoPlaceCandidate => Boolean(candidate));
      const classified = classifyCandidates(name, candidates);
      const retrievedAt = context.now;

      if (classified.status === "RESOLVED") {
        return {
          status: "RESOLVED",
          capability: query.capability,
          providerId: "geo.open_meteo",
          providerVersion: version,
          sourceClass: "REFERENCE_DATA",
          value: classified.value,
          sourceId: "open-meteo-geocoding",
          sourceVersion: "v1",
          retrievedAt,
          authority: "HIGH",
          confidence: classified.confidence,
          lineage: { query: name, providerPlaceId: classified.value.providerPlaceId }
        };
      }

      if (classified.status === "AMBIGUOUS") {
        return {
          status: "AMBIGUOUS",
          capability: query.capability,
          providerId: "geo.open_meteo",
          providerVersion: version,
          sourceClass: "REFERENCE_DATA",
          candidates: classified.candidates,
          sourceId: "open-meteo-geocoding",
          sourceVersion: "v1",
          retrievedAt,
          authority: "HIGH",
          lineage: { query: name },
          limitation: "Multiple plausible geographic matches remain. Player clarification is required before timed natal calculation."
        };
      }

      return {
        status: "UNKNOWN",
        capability: query.capability,
        providerId: "geo.open_meteo",
        providerVersion: version,
        sourceClass: "REFERENCE_DATA",
        sourceId: "open-meteo-geocoding",
        sourceVersion: "v1",
        retrievedAt,
        authority: "HIGH",
        limitation: "No geographic match was returned for the recorded birthplace label."
      };
    }
  };
}

export function createResolvedPlaceTimezoneProvider(): KnowledgeProvider {
  const version = "resolved-place-timezone-v1";
  return {
    id: "geo.resolved_place_timezone",
    version,
    sourceClass: "REFERENCE_DATA",
    capabilities: ["geo.resolve_timezone"],
    priority: 50,
    resolve(query): KnowledgeResolution<{ timeZone: string }> {
      const input = query.input as ResolveTimezoneInput;
      const zone = input?.place?.timezone?.trim();
      if (!zone) {
        return {
          status: "UNKNOWN",
          capability: query.capability,
          providerId: "geo.resolved_place_timezone",
          providerVersion: version,
          sourceClass: "REFERENCE_DATA",
          limitation: "Resolved place did not include an IANA timezone."
        };
      }

      try {
        new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date(0));
      } catch {
        return {
          status: "CONFLICTING",
          capability: query.capability,
          providerId: "geo.resolved_place_timezone",
          providerVersion: version,
          sourceClass: "REFERENCE_DATA",
          limitation: `Provider returned an invalid IANA timezone: ${zone}`
        };
      }

      return {
        status: "RESOLVED",
        capability: query.capability,
        providerId: "geo.resolved_place_timezone",
        providerVersion: version,
        sourceClass: "REFERENCE_DATA",
        value: { timeZone: zone },
        sourceId: "resolved-geographic-place",
        sourceVersion: input.place.providerPlaceId,
        authority: "HIGH",
        confidence: 0.99,
        lineage: {
          providerPlaceId: input.place.providerPlaceId,
          latitude: input.place.latitude,
          longitude: input.place.longitude
        }
      };
    }
  };
}
