import type { KnowledgeProvider, KnowledgeResolution } from "./contracts.ts";

export interface ResolveLocalInstantInput {
  localDate: string;
  localTime: string;
  timeZone: string;
}

export interface ResolvedLocalInstant {
  utcInstant: string;
  utcOffsetMinutes: number;
  timeZone: string;
  localDateTime: string;
  resolutionMethod: "INTL_TZDB_RUNTIME";
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function parseDate(value: string): Pick<LocalParts, "year" | "month" | "day"> | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function parseTime(value: string): Pick<LocalParts, "hour" | "minute" | "second"> | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

function formatParts(date: Date, timeZone: string): LocalParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (value == null) throw new Error(`TIMEZONE_PART_MISSING:${type}`);
    return Number(value);
  };
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second")
  };
}

function sameParts(a: LocalParts, b: LocalParts) {
  return (
    a.year === b.year &&
    a.month === b.month &&
    a.day === b.day &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.second === b.second
  );
}

function offsetMinutesAt(utcMs: number, timeZone: string) {
  const local = formatParts(new Date(utcMs), timeZone);
  const asIfUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second
  );
  return Math.round((asIfUtc - utcMs) / 60000);
}

function resolveCandidateMs(target: LocalParts, timeZone: string) {
  const localAsUtc = Date.UTC(
    target.year,
    target.month - 1,
    target.day,
    target.hour,
    target.minute,
    target.second
  );

  let candidate = localAsUtc;
  for (let index = 0; index < 4; index += 1) {
    const offset = offsetMinutesAt(candidate, timeZone);
    const next = localAsUtc - offset * 60000;
    if (next === candidate) break;
    candidate = next;
  }
  return candidate;
}

function findMatchingInstants(target: LocalParts, timeZone: string) {
  const seed = resolveCandidateMs(target, timeZone);
  const matches = new Set<number>();

  // Search around the iterative solution to detect DST folds and unusual
  // half-hour transitions without assuming a fixed one-hour shift.
  for (let deltaMinutes = -180; deltaMinutes <= 180; deltaMinutes += 5) {
    const candidate = seed + deltaMinutes * 60000;
    if (sameParts(formatParts(new Date(candidate), timeZone), target)) {
      matches.add(candidate);
    }
  }

  return [...matches].sort((a, b) => a - b);
}

function toResolved(utcMs: number, timeZone: string, localDateTime: string): ResolvedLocalInstant {
  return {
    utcInstant: new Date(utcMs).toISOString(),
    utcOffsetMinutes: offsetMinutesAt(utcMs, timeZone),
    timeZone,
    localDateTime,
    resolutionMethod: "INTL_TZDB_RUNTIME"
  };
}

export function resolveIntlLocalInstantValue(input: ResolveLocalInstantInput): ResolvedLocalInstant | null {
  const date = parseDate(input?.localDate ?? "");
  const time = parseTime(input?.localTime ?? "");
  const zone = input?.timeZone?.trim();
  if (!date || !time || !zone) return null;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date(0));
  } catch {
    return null;
  }

  const target: LocalParts = { ...date, ...time };
  const matches = findMatchingInstants(target, zone);
  if (matches.length !== 1) return null;
  return toResolved(matches[0], zone, `${input.localDate}T${input.localTime}`);
}

export function createIntlLocalInstantProvider(): KnowledgeProvider {
  const version = "intl-local-instant-v1";

  return {
    id: "time.intl_local_instant",
    version,
    sourceClass: "DETERMINISTIC",
    capabilities: ["time.resolve_local_instant"],
    priority: 50,
    resolve(query): KnowledgeResolution<ResolvedLocalInstant> {
      const input = query.input as ResolveLocalInstantInput;
      const date = parseDate(input?.localDate ?? "");
      const time = parseTime(input?.localTime ?? "");
      const zone = input?.timeZone?.trim();

      if (!date || !time || !zone) {
        return {
          status: "UNKNOWN",
          capability: query.capability,
          providerId: "time.intl_local_instant",
          providerVersion: version,
          sourceClass: "DETERMINISTIC",
          limitation: "A valid local date, local time, and IANA timezone are required."
        };
      }

      try {
        new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date(0));
      } catch {
        return {
          status: "CONFLICTING",
          capability: query.capability,
          providerId: "time.intl_local_instant",
          providerVersion: version,
          sourceClass: "DETERMINISTIC",
          limitation: `Invalid IANA timezone: ${zone}`
        };
      }

      const target: LocalParts = { ...date, ...time };
      const matches = findMatchingInstants(target, zone);
      const localDateTime = `${input.localDate}T${input.localTime}`;

      if (matches.length === 0) {
        return {
          status: "CONFLICTING",
          capability: query.capability,
          providerId: "time.intl_local_instant",
          providerVersion: version,
          sourceClass: "DETERMINISTIC",
          sourceId: "runtime-intl-timezone-database",
          sourceVersion: version,
          limitation: "The recorded local wall time does not map to a valid instant in this timezone, which can occur during a daylight-saving clock gap.",
          lineage: { localDateTime, timeZone: zone }
        };
      }

      if (matches.length > 1) {
        return {
          status: "AMBIGUOUS",
          capability: query.capability,
          providerId: "time.intl_local_instant",
          providerVersion: version,
          sourceClass: "DETERMINISTIC",
          candidates: matches.map((value) => toResolved(value, zone, localDateTime)),
          sourceId: "runtime-intl-timezone-database",
          sourceVersion: version,
          limitation: "The recorded local wall time maps to more than one UTC instant because of a timezone clock fold.",
          lineage: { localDateTime, timeZone: zone }
        };
      }

      return {
        status: "RESOLVED",
        capability: query.capability,
        providerId: "time.intl_local_instant",
        providerVersion: version,
        sourceClass: "DETERMINISTIC",
        value: toResolved(matches[0], zone, localDateTime),
        sourceId: "runtime-intl-timezone-database",
        sourceVersion: version,
        authority: "HIGH",
        confidence: 1,
        lineage: {
          localDateTime,
          timeZone: zone,
          note: "Runtime Intl timezone rules are used in v0.1. A frozen/version-identifiable tzdb is still required before treating persisted natal output as perfectly reproducible across runtimes."
        }
      };
    }
  };
}
