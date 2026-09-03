import { describe, expect, it } from "vitest";
import {
  earliestSlot,
  meetingFits,
  selectSlot,
  snapDown15,
} from "../src/lib/slots";

const overlap = {
  startMs: Date.UTC(2026, 8, 2, 14, 0, 0),
  endMs: Date.UTC(2026, 8, 2, 17, 0, 0),
};

describe("duration / slot selection", () => {
  it("rejects a duration longer than the overlap", () => {
    const tiny = { startMs: overlap.startMs, endMs: overlap.startMs + 20 * 60 * 1000 };
    expect(selectSlot(tiny, tiny.startMs, 30)).toBeNull();
    expect(meetingFits(tiny, tiny.startMs, 30)).toBe(false);
  });

  it("snaps a click down to 15 minutes and keeps the meeting inside overlap", () => {
    const click = overlap.startMs + (7 * 60 + 8) * 1000;
    const slot = selectSlot(overlap, click, 45);
    expect(slot).not.toBeNull();
    expect(slot!.durationMin).toBe(45);
    expect(slot!.endMs - slot!.startMs).toBe(45 * 60 * 1000);
    expect(slot!.startMs).toBe(snapDown15(click));
    expect(slot!.startMs % (15 * 60 * 1000)).toBe(0);
    expect(meetingFits(overlap, slot!.startMs, 45)).toBe(true);
  });

  it("clamps a late click so a 60-minute meeting still fits", () => {
    const late = overlap.endMs - 5 * 60 * 1000;
    const slot = selectSlot(overlap, late, 60);
    expect(slot).not.toBeNull();
    expect(slot!.endMs).toBeLessThanOrEqual(overlap.endMs);
    expect(slot!.startMs).toBeGreaterThanOrEqual(overlap.startMs);
    expect(slot!.endMs - slot!.startMs).toBe(60 * 60 * 1000);
  });

  it("earliestSlot starts at the overlap begin for 30 minutes", () => {
    const slot = earliestSlot(overlap, 30);
    expect(slot!.startMs).toBe(overlap.startMs);
    expect(slot!.endMs).toBe(overlap.startMs + 30 * 60 * 1000);
  });
});
