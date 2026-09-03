import { describe, expect, it } from "vitest";
import {
  decodeHash,
  encodeHash,
  sanitizeState,
  type AppState,
} from "../src/lib/state";

const sample: AppState = {
  dateISO: "2026-09-02",
  durationMin: 45,
  selectedStartMs: 1_725_000_000_000,
  people: [
    {
      id: "a1",
      name: "Alex",
      timeZone: "America/Denver",
      workStart: "09:00",
      workEnd: "17:00",
    },
    {
      id: "b2",
      name: "Blair",
      timeZone: "Europe/London",
      workStart: "08:30",
      workEnd: "16:30",
    },
  ],
};

describe("URL hash encode/decode", () => {
  it("round-trips people, hours, date, duration, and selected slot", () => {
    const hash = encodeHash(sample);
    const restored = decodeHash(hash, "2020-01-01");
    expect(restored).not.toBeNull();
    expect(restored!.dateISO).toBe("2026-09-02");
    expect(restored!.durationMin).toBe(45);
    expect(restored!.selectedStartMs).toBe(sample.selectedStartMs);
    expect(restored!.people).toHaveLength(2);
    expect(restored!.people[0].name).toBe("Alex");
    expect(restored!.people[0].timeZone).toBe("America/Denver");
    expect(restored!.people[1].workStart).toBe("08:30");
    expect(restored!.people[1].workEnd).toBe("16:30");
  });

  it("accepts a leading #", () => {
    const hash = encodeHash(sample);
    expect(decodeHash("#" + hash, "2020-01-01")?.dateISO).toBe("2026-09-02");
  });

  it("returns null for empty or corrupt hashes", () => {
    expect(decodeHash("", "2026-01-01")).toBeNull();
    expect(decodeHash("#not-json", "2026-01-01")).toBeNull();
    expect(decodeHash(encodeURIComponent("{}"), "2026-01-01")).toBeNull();
  });

  it("sanitizeState drops garbage and keeps a fallback date", () => {
    const s = sanitizeState(
      { dateISO: "nope", durationMin: 12, people: [{ name: "X", timeZone: "UTC" }] },
      "2026-09-02",
    );
    expect(s.dateISO).toBe("2026-09-02");
    expect(s.durationMin).toBe(30);
    expect(s.people[0].name).toBe("X");
    expect(s.people[0].workStart).toBe("09:00");
  });
});
