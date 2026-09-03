/** Common IANA zones shown first in the picker. */
export const COMMON_TIMEZONES: string[] = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Santiago",
  "America/Caracas",
  "Atlantic/Reykjavik",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Zurich",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "Europe/Warsaw",
  "Europe/Prague",
  "Europe/Vienna",
  "Europe/Athens",
  "Europe/Helsinki",
  "Europe/Bucharest",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Africa/Casablanca",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Tehran",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Taipei",
  "Asia/Seoul",
  "Asia/Tokyo",
  "Asia/Manila",
  "Australia/Perth",
  "Australia/Adelaide",
  "Australia/Sydney",
  "Australia/Brisbane",
  "Pacific/Auckland",
  "Pacific/Fiji",
];

export function supportedTimeZones(): string[] {
  const intl =
    typeof Intl !== "undefined" &&
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : [];
  const set = new Set<string>([...COMMON_TIMEZONES, ...intl]);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function isValidTimeZone(zone: string): boolean {
  if (!zone || zone.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function filterTimeZones(query: string, all: string[]): string[] {
  const q = query.trim().toLowerCase().replace(/\s+/g, "_");
  if (!q) return all.slice(0, 40);
  return all.filter((z) => z.toLowerCase().includes(q)).slice(0, 40);
}

export function formatOffsetLabel(dateISO: string, timeZone: string): string {
  const noon = localWallToUtcMs(dateISO, 12, 0, timeZone);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
  });
  const part = fmt
    .formatToParts(new Date(noon.utcMs))
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? timeZone;
}

export interface WallToUtc {
  utcMs: number;
  skipped: boolean;
  ambiguous: boolean;
}

function partsToMap(
  parts: Intl.DateTimeFormatPart[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return map;
}

const wallFormatterCache = new Map<string, Intl.DateTimeFormat>();

function wallFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = wallFormatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    wallFormatterCache.set(timeZone, f);
  }
  return f;
}

export function utcMsToWall(
  utcMs: number,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const map = partsToMap(wallFormatter(timeZone).formatToParts(new Date(utcMs)));
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Offset of this instant in the zone: local-as-UTC minus actual UTC. */
export function offsetMsAt(utcMs: number, timeZone: string): number {
  const w = utcMsToWall(utcMs, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - utcMs;
}

/**
 * Convert a local wall-clock time in `timeZone` to UTC.
 * Uses Temporal.ZonedDateTime when available; otherwise Intl offset matching.
 * Skipped times (spring-forward) snap forward to the next valid instant.
 * Ambiguous times (fall-back) use the earlier occurrence.
 */
export function localWallToUtcMs(
  dateISO: string,
  hour: number,
  minute: number,
  timeZone: string,
): WallToUtc {
  const [ys, ms, ds] = dateISO.split("-").map(Number);
  const TemporalObj = (
    globalThis as unknown as {
      Temporal?: {
        ZonedDateTime: {
          from: (s: string) => { epochMilliseconds: number };
        };
      };
    }
  ).Temporal;

  if (TemporalObj?.ZonedDateTime) {
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    try {
      const zdt = TemporalObj.ZonedDateTime.from(
        `${dateISO}T${hh}:${mm}:00[${timeZone}]`,
      );
      return { utcMs: zdt.epochMilliseconds, skipped: false, ambiguous: false };
    } catch {
      // fall through to Intl path for skipped/disambiguation
    }
  }

  const desired = Date.UTC(ys, ms - 1, ds, hour, minute, 0);

  // Iterate offset: utc = desiredLocalAsUtc - offset(utc)
  let utc = desired;
  for (let i = 0; i < 4; i++) {
    utc = desired - offsetMsAt(utc, timeZone);
  }

  const wall = utcMsToWall(utc, timeZone);
  const matches =
    wall.year === ys &&
    wall.month === ms &&
    wall.day === ds &&
    wall.hour === hour &&
    wall.minute === minute;

  if (matches) {
    const sameWall = (t: number) => {
      const w = utcMsToWall(t, timeZone);
      return (
        w.year === ys &&
        w.month === ms &&
        w.day === ds &&
        w.hour === hour &&
        w.minute === minute
      );
    };
    const earlier = utc - 60 * 60 * 1000;
    const later = utc + 60 * 60 * 1000;
    const ambiguous = sameWall(earlier) || sameWall(later);
    const utcMs = sameWall(earlier) ? earlier : utc;
    return { utcMs, skipped: false, ambiguous };
  }

  // Skipped (spring-forward): walk forward in 15-min steps until wall time >= desired that day,
  // otherwise take the first instant after the gap.
  let probe = utc;
  for (let i = 0; i < 8; i++) {
    probe += 15 * 60 * 1000;
    const w = utcMsToWall(probe, timeZone);
    if (
      w.year === ys &&
      w.month === ms &&
      w.day === ds &&
      (w.hour > hour || (w.hour === hour && w.minute >= minute))
    ) {
      return { utcMs: probe - (w.minute % 15 === 0 && w.hour !== hour ? 0 : 0), skipped: true, ambiguous: false };
    }
  }

  // Snap to the first valid instant whose wall clock is after the gap on this date.
  const startOfDay = Date.UTC(ys, ms - 1, ds, 0, 0, 0) - offsetMsAt(desired, timeZone);
  for (let t = startOfDay; t < startOfDay + 36 * 3600 * 1000; t += 60 * 1000) {
    const w = utcMsToWall(t, timeZone);
    if (w.year !== ys || w.month !== ms || w.day !== ds) continue;
    if (w.hour > hour || (w.hour === hour && w.minute >= minute)) {
      return { utcMs: t, skipped: true, ambiguous: false };
    }
  }

  return { utcMs: utc, skipped: true, ambiguous: false };
}

export function parseHm(hm: string): { hour: number; minute: number } | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hm.trim());
  if (!m) return null;
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

export function formatHm(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

export function todayISO(timeZone = "UTC"): string {
  const w = utcMsToWall(Date.now(), timeZone);
  return `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
}

export function formatInZone(
  utcMs: number,
  timeZone: string,
  opts?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    ...opts,
  }).format(new Date(utcMs));
}

export function formatDateTimeInZone(utcMs: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(new Date(utcMs));
}
