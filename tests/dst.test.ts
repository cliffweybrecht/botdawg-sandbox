import { describe, expect, it } from "vitest";
import { isDstTransitionDate, personWorkInterval } from "../src/lib/overlap";
import { localWallToUtcMs, offsetMsAt, utcMsToWall } from "../src/lib/timezones";

const DENVER = "America/Denver";
// US DST 2026: spring-forward 2026-03-08 02:00 → 03:00; fall-back 2026-11-01 02:00 → 01:00
const SPRING = "2026-03-08";
const FALL = "2026-11-01";
const WINTER = "2026-01-14";
const SUMMER = "2026-07-15";

describe("DST edge cases (America/Denver)", () => {
  it("detects spring-forward and fall-back civil dates", () => {
    expect(isDstTransitionDate(SPRING, DENVER)).toBe(true);
    expect(isDstTransitionDate(FALL, DENVER)).toBe(true);
    expect(isDstTransitionDate(WINTER, DENVER)).toBe(false);
    expect(isDstTransitionDate(SUMMER, DENVER)).toBe(false);
  });

  it("skips the missing 02:30 on spring-forward", () => {
    const twoThirty = localWallToUtcMs(SPRING, 2, 30, DENVER);
    expect(twoThirty.skipped).toBe(true);
    const wall = utcMsToWall(twoThirty.utcMs, DENVER);
    // 02:30 does not exist; converter snaps to a valid local time that day (03:00+)
    expect(wall.month).toBe(3);
    expect(wall.day).toBe(8);
    expect(wall.hour === 2).toBe(false);
    expect(wall.hour).toBeGreaterThanOrEqual(3);
  });

  it("spring-forward workday 09:00–17:00 is still eight hours of real time", () => {
    const iv = personWorkInterval(
      {
        id: "den",
        name: "Denver",
        timeZone: DENVER,
        workStart: "09:00",
        workEnd: "17:00",
      },
      SPRING,
    );
    expect(iv).not.toBeNull();
    expect(iv!.endMs - iv!.startMs).toBe(8 * 3600 * 1000);
    const startWall = utcMsToWall(iv!.startMs, DENVER);
    const endWall = utcMsToWall(iv!.endMs, DENVER);
    expect(startWall.hour).toBe(9);
    expect(endWall.hour).toBe(17);
  });

  it("offset jumps by one hour across the spring-forward", () => {
    const before = localWallToUtcMs(SPRING, 1, 30, DENVER);
    const after = localWallToUtcMs(SPRING, 3, 30, DENVER);
    expect(before.skipped).toBe(false);
    expect(after.skipped).toBe(false);
    const oBefore = offsetMsAt(before.utcMs, DENVER);
    const oAfter = offsetMsAt(after.utcMs, DENVER);
    // MST UTC-7 → MDT UTC-6; offsetMs = localAsUtc - utc, so -7h then -6h
    expect(oAfter - oBefore).toBe(3600 * 1000);
    // Real elapsed time 01:30 → 03:30 is 1 hour, not 2
    expect(after.utcMs - before.utcMs).toBe(3600 * 1000);
  });

  it("fall-back 01:30 is ambiguous and uses the earlier occurrence", () => {
    const once = localWallToUtcMs(FALL, 1, 30, DENVER);
    expect(once.ambiguous).toBe(true);
    const later = once.utcMs + 3600 * 1000;
    const w1 = utcMsToWall(once.utcMs, DENVER);
    const w2 = utcMsToWall(later, DENVER);
    expect(w1.hour).toBe(1);
    expect(w1.minute).toBe(30);
    expect(w2.hour).toBe(1);
    expect(w2.minute).toBe(30);
    const o1 = offsetMsAt(once.utcMs, DENVER);
    const o2 = offsetMsAt(later, DENVER);
    expect(o1).toBeGreaterThan(o2); // MDT then MST
  });

  it("fall-back workday 09:00–17:00 remains eight hours", () => {
    const iv = personWorkInterval(
      {
        id: "den",
        name: "Denver",
        timeZone: DENVER,
        workStart: "09:00",
        workEnd: "17:00",
      },
      FALL,
    );
    expect(iv!.endMs - iv!.startMs).toBe(8 * 3600 * 1000);
  });

  it("Phoenix does not transition on US DST dates", () => {
    expect(isDstTransitionDate(SPRING, "America/Phoenix")).toBe(false);
    expect(isDstTransitionDate(FALL, "America/Phoenix")).toBe(false);
  });
});
