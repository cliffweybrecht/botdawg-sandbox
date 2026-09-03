import {
  addDaysISO,
  localWallToUtcMs,
  offsetMsAt,
  parseHm,
  utcMsToWall,
} from "./timezones";

export interface Person {
  id: string;
  name: string;
  timeZone: string;
  workStart: string;
  workEnd: string;
}

export interface Interval {
  startMs: number;
  endMs: number;
}

export interface PersonInterval extends Interval {
  personId: string;
  skippedStart: boolean;
  skippedEnd: boolean;
  ambiguous: boolean;
}

export function personWorkInterval(
  person: Person,
  dateISO: string,
): PersonInterval | null {
  const startHm = parseHm(person.workStart);
  const endHm = parseHm(person.workEnd);
  if (!startHm || !endHm) return null;

  const start = localWallToUtcMs(
    dateISO,
    startHm.hour,
    startHm.minute,
    person.timeZone,
  );
  let end = localWallToUtcMs(
    dateISO,
    endHm.hour,
    endHm.minute,
    person.timeZone,
  );

  let endMs = end.utcMs;
  if (endMs <= start.utcMs) {
    const next = addDaysISO(dateISO, 1);
    end = localWallToUtcMs(next, endHm.hour, endHm.minute, person.timeZone);
    endMs = end.utcMs;
  }

  if (endMs <= start.utcMs) return null;

  return {
    personId: person.id,
    startMs: start.utcMs,
    endMs,
    skippedStart: start.skipped,
    skippedEnd: end.skipped,
    ambiguous: start.ambiguous || end.ambiguous,
  };
}

export function intersectAll(intervals: Interval[]): Interval | null {
  if (intervals.length === 0) return null;
  const startMs = Math.max(...intervals.map((i) => i.startMs));
  const endMs = Math.min(...intervals.map((i) => i.endMs));
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return null;
  }
  return { startMs, endMs };
}

export function computeOverlap(
  people: Person[],
  dateISO: string,
): {
  intervals: PersonInterval[];
  overlap: Interval | null;
} {
  const intervals: PersonInterval[] = [];
  for (const p of people) {
    const iv = personWorkInterval(p, dateISO);
    if (iv) intervals.push(iv);
  }
  if (intervals.length === 0 || intervals.length < people.length) {
    return { intervals, overlap: intervals.length === people.length && people.length > 0 ? intersectAll(intervals) : null };
  }
  return { intervals, overlap: intersectAll(intervals) };
}

/** True if the zone's UTC offset changes during this civil date. */
export function isDstTransitionDate(dateISO: string, timeZone: string): boolean {
  const offsets = new Set<number>();
  for (let h = 0; h < 24; h++) {
    const r = localWallToUtcMs(dateISO, h, 0, timeZone);
    if (r.skipped || r.ambiguous) return true;
    offsets.add(offsetMsAt(r.utcMs, timeZone));
  }
  return offsets.size > 1;
}

export function dstNotes(people: Person[], dateISO: string): string[] {
  const notes: string[] = [];
  const seen = new Set<string>();
  for (const p of people) {
    if (seen.has(p.timeZone)) continue;
    if (isDstTransitionDate(dateISO, p.timeZone)) {
      seen.add(p.timeZone);
      const name = p.name.trim() || "Someone";
      notes.push(
        `${name}'s zone (${p.timeZone}) has a DST transition on ${dateISO}. Local clocks skip or repeat an hour; overlap may look uneven.`,
      );
    }
  }
  return notes;
}

export function timelineBounds(intervals: Interval[], overlap: Interval | null): Interval {
  if (intervals.length === 0) {
    const now = Date.now();
    return { startMs: now, endMs: now + 24 * 3600 * 1000 };
  }
  let startMs = Math.min(...intervals.map((i) => i.startMs));
  let endMs = Math.max(...intervals.map((i) => i.endMs));
  if (overlap) {
    startMs = Math.min(startMs, overlap.startMs);
    endMs = Math.max(endMs, overlap.endMs);
  }
  const pad = 30 * 60 * 1000;
  return { startMs: startMs - pad, endMs: endMs + pad };
}

export function formatDurationMs(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export function wallClockOnDate(
  utcMs: number,
  timeZone: string,
  dateISO: string,
): string {
  const w = utcMsToWall(utcMs, timeZone);
  const iso = `${w.year}-${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
  const hm = `${String(w.hour).padStart(2, "0")}:${String(w.minute).padStart(2, "0")}`;
  if (iso !== dateISO) {
    return `${hm} (${iso})`;
  }
  return hm;
}
