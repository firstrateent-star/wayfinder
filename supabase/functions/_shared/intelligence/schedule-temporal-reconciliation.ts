import type { SourceEnvelope } from "./semantic-admission.ts";
import { resolveIntlLocalInstantValue } from "./local-time-resolver.ts";

export interface RecoveredScheduleInterval {
  from: string;
  to: string;
  localDate: string;
  relativeText: "today" | "tomorrow";
}

function localDateInZone(instant: string, zoneId: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zoneId,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addCalendarDays(localDate: string, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return null;
  const value = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function time24(hourText: string, minuteText: string | undefined, meridiem: string) {
  const hour = Number(hourText);
  const minute = Number(minuteText ?? "0");
  if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  const upper = meridiem.toUpperCase();
  let hour24 = hour % 12;
  if (upper === "PM") hour24 += 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
}

/**
 * Deterministically preserves a narrow, explicit player clock interval after
 * semantic classification has already decided this is a Schedule allocation.
 * It does not decide that something belongs to Schedule.
 */
export function recoverExplicitScheduleInterval(source: SourceEnvelope): RecoveredScheduleInterval | null {
  const zoneId = source.zoneId?.trim();
  if (!zoneId || !Number.isFinite(Date.parse(source.receivedAt))) return null;

  const match = source.content.match(
    /\b(today|tomorrow)\b[^.!?\n]{0,80}?\bfrom\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(?:to|[-–—])\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i
  );
  if (!match) return null;

  const relativeText = match[1].toLowerCase() as "today" | "tomorrow";
  const startHour = Number(match[2]);
  const endHour = Number(match[5]);
  const explicitStartMeridiem = match[4]?.toUpperCase();
  const endMeridiem = match[7]?.toUpperCase();
  if (!endMeridiem) return null;

  // "1 to 3 PM" is unambiguous enough to inherit PM. "11 to 1 PM" crosses
  // a meridiem boundary and is not safe to infer without an explicit AM/PM.
  const startMeridiem = explicitStartMeridiem ?? (startHour <= endHour ? endMeridiem : null);
  if (!startMeridiem) return null;

  const startTime = time24(match[2], match[3], startMeridiem);
  const endTime = time24(match[5], match[6], endMeridiem);
  if (!startTime || !endTime) return null;

  const baseLocalDate = localDateInZone(source.receivedAt, zoneId);
  const localDate = addCalendarDays(baseLocalDate, relativeText === "tomorrow" ? 1 : 0);
  if (!localDate) return null;

  const start = resolveIntlLocalInstantValue({ localDate, localTime: startTime, timeZone: zoneId });
  const end = resolveIntlLocalInstantValue({ localDate, localTime: endTime, timeZone: zoneId });
  if (!start || !end || Date.parse(end.utcInstant) <= Date.parse(start.utcInstant)) return null;

  return {
    from: start.utcInstant,
    to: end.utcInstant,
    localDate,
    relativeText
  };
}
