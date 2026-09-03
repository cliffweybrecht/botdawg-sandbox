import { describe, expect, it } from "vitest";
import {
  computeOverlap,
  intersectAll,
  personWorkInterval,
} from "../src/lib/overlap";
import { localWallToUtcMs } from "../src/lib/timezones";
import type { Person } from "../src/lib/overlap";

function p(
  id: string,
  timeZone: string,
  start = "09:00",
  end = "17:00",
): Person {
  return { id, name: id, timeZone, workStart: start, workEnd: end };
}

describe("overlap calculation", () => {
  it("finds London / New York winter overlap in UTC", () => {
    // 2026-01-14 is standard time: London GMT (UTC+0), New York EST (UTC-5)
    const date = "2026-01-14";
    const { overlap, intervals } = computeOverlap(
      [p("lon", "Europe/London"), p("nyc", "America/New_York")],
      date,
    );
    expect(intervals).toHaveLength(2);
    expect(overlap).not.toBeNull();
    // London 09:00–17:00 UTC; NYC 14:00–22:00 UTC → 14:00–17:00 UTC
    const lonStart = localWallToUtcMs(date, 9, 0, "Europe/London").utcMs;
    const lonEnd = localWallToUtcMs(date, 17, 0, "Europe/London").utcMs;
    const nycStart = localWallToUtcMs(date, 9, 0, "America/New_York").utcMs;
    const nycEnd = localWallToUtcMs(date, 17, 0, "America/New_York").utcMs;
    expect(overlap!.startMs).toBe(Math.max(lonStart, nycStart));
    expect(overlap!.endMs).toBe(Math.min(lonEnd, nycEnd));
    expect(overlap!.endMs - overlap!.startMs).toBe(3 * 3600 * 1000);
  });

  it("returns no overlap for Tokyo and New York 09–17", () => {
    const { overlap } = computeOverlap(
      [p("tyo", "Asia/Tokyo"), p("nyc", "America/New_York")],
      "2026-01-14",
    );
    expect(overlap).toBeNull();
  });

  it("treats a single person as overlapping their own hours", () => {
    const { overlap } = computeOverlap(
      [p("den", "America/Denver")],
      "2026-09-02",
    );
    expect(overlap).not.toBeNull();
    const start = localWallToUtcMs("2026-09-02", 9, 0, "America/Denver").utcMs;
    const end = localWallToUtcMs("2026-09-02", 17, 0, "America/Denver").utcMs;
    expect(overlap!.startMs).toBe(start);
    expect(overlap!.endMs).toBe(end);
  });

  it("handles overnight hours crossing midnight", () => {
    const night = p("oncall", "UTC", "22:00", "06:00");
    const iv = personWorkInterval(night, "2026-09-02");
    expect(iv).not.toBeNull();
    expect(iv!.endMs - iv!.startMs).toBe(8 * 3600 * 1000);
  });

  it("intersectAll is empty when any interval is disjoint", () => {
    expect(
      intersectAll([
        { startMs: 0, endMs: 10 },
        { startMs: 20, endMs: 30 },
      ]),
    ).toBeNull();
    expect(intersectAll([])).toBeNull();
    expect(intersectAll([{ startMs: 5, endMs: 15 }, { startMs: 10, endMs: 20 }])).toEqual({
      startMs: 10,
      endMs: 15,
    });
  });

  it("ignores invalid people without producing a false overlap", () => {
    const { overlap, intervals } = computeOverlap(
      [p("a", "America/New_York"), p("b", "Europe/London")],
      "2026-06-15",
    );
    expect(intervals).toHaveLength(2);
    expect(overlap).not.toBeNull();
    // summer: London BST UTC+1 (08:00–16:00 UTC), NYC EDT UTC-4 (13:00–21:00 UTC) → 13–16 UTC
    expect(overlap!.endMs - overlap!.startMs).toBe(3 * 3600 * 1000);
  });
});
