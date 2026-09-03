import type { Interval } from "./overlap";

export const DURATIONS = [30, 45, 60] as const;
export type DurationMin = (typeof DURATIONS)[number];

export function isDuration(n: number): n is DurationMin {
  return (DURATIONS as readonly number[]).includes(n);
}

/** Snap an instant down to a 15-minute grid (UTC). */
export function snapDown15(utcMs: number): number {
  const q = 15 * 60 * 1000;
  return Math.floor(utcMs / q) * q;
}

export function snapNearest15(utcMs: number): number {
  const q = 15 * 60 * 1000;
  return Math.round(utcMs / q) * q;
}

export interface ProposedMeeting {
  startMs: number;
  endMs: number;
  durationMin: DurationMin;
}

export function meetingFits(
  overlap: Interval,
  startMs: number,
  durationMin: number,
): boolean {
  const endMs = startMs + durationMin * 60 * 1000;
  return startMs >= overlap.startMs && endMs <= overlap.endMs;
}

/**
 * Choose a meeting that starts at `clickedMs` (snapped down to 15 min)
 * with the given duration, clamped so it still sits inside the overlap
 * when possible. Returns null if the overlap is shorter than duration.
 */
export function selectSlot(
  overlap: Interval,
  clickedMs: number,
  durationMin: DurationMin,
): ProposedMeeting | null {
  const need = durationMin * 60 * 1000;
  const span = overlap.endMs - overlap.startMs;
  if (span < need) return null;

  let start = snapDown15(clickedMs);
  if (start < overlap.startMs) start = snapDown15(overlap.startMs);
  if (start < overlap.startMs) start = overlap.startMs;

  if (start + need > overlap.endMs) {
    start = overlap.endMs - need;
    const snapped = snapDown15(start);
    if (snapped >= overlap.startMs && snapped + need <= overlap.endMs) {
      start = snapped;
    }
  }

  if (!meetingFits(overlap, start, durationMin)) {
    start = overlap.startMs;
    if (!meetingFits(overlap, start, durationMin)) return null;
  }

  return { startMs: start, endMs: start + need, durationMin };
}

export function earliestSlot(
  overlap: Interval,
  durationMin: DurationMin,
): ProposedMeeting | null {
  return selectSlot(overlap, overlap.startMs, durationMin);
}

export function slotTicks(overlap: Interval, stepMin = 15): number[] {
  const step = stepMin * 60 * 1000;
  const ticks: number[] = [];
  let t = snapDown15(overlap.startMs);
  if (t < overlap.startMs) t += step;
  for (; t <= overlap.endMs; t += step) ticks.push(t);
  return ticks;
}
