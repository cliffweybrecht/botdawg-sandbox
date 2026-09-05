import { describe, it, expect } from "vitest";
import {
  computeReferenceDivergenceFromPrices,
  isFinitePositive,
  rationalToNumber,
  roundHalfAwayFromZero,
} from "../src/measurement/math.js";
import { classifyReferenceStatus } from "../src/measurement/measure.js";

describe("measurement math V1", () => {
  it("computes divergence from underlying RH and DEX prices", () => {
    const d = computeReferenceDivergenceFromPrices(100, 101);
    expect(d).not.toBeNull();
    expect(d!.pct).toBeCloseTo(1, 12);
    expect(d!.bps).toBeCloseTo(100, 10);
    expect(d!.usdPerShare).toBeCloseTo(1, 12);
  });

  it("negative divergence when DEX below RH", () => {
    const d = computeReferenceDivergenceFromPrices(100, 99);
    expect(d!.pct).toBeCloseTo(-1, 12);
    expect(d!.bps).toBeCloseTo(-100, 10);
  });

  it("fail-closed for RH <= 0, DEX <= 0, NaN, Infinity", () => {
    expect(computeReferenceDivergenceFromPrices(0, 101)).toBeNull();
    expect(computeReferenceDivergenceFromPrices(-1, 101)).toBeNull();
    expect(computeReferenceDivergenceFromPrices(100, 0)).toBeNull();
    expect(computeReferenceDivergenceFromPrices(100, -5)).toBeNull();
    expect(computeReferenceDivergenceFromPrices(Number.NaN, 101)).toBeNull();
    expect(computeReferenceDivergenceFromPrices(100, Number.POSITIVE_INFINITY)).toBeNull();
    expect(isFinitePositive(0)).toBe(false);
  });

  it("rationalToNumber rejects bad denom", () => {
    expect(rationalToNumber("50", "1")).toBe(50);
    expect(rationalToNumber("1", "0")).toBeNull();
  });

  it("roundHalfAwayFromZero", () => {
    expect(roundHalfAwayFromZero(1.235, 2)).toBe(1.24);
    expect(roundHalfAwayFromZero(-1.235, 2)).toBe(-1.24);
  });

  it("tolerance inclusive: |bps| <= tol => NO; just above => signed", () => {
    expect(classifyReferenceStatus(0, 0)).toBe("NO_REFERENCE_DIVERGENCE");
    expect(classifyReferenceStatus(1, 1)).toBe("NO_REFERENCE_DIVERGENCE");
    expect(classifyReferenceStatus(-1, 1)).toBe("NO_REFERENCE_DIVERGENCE");
    expect(classifyReferenceStatus(1.0001, 1)).toBe("POSITIVE_REFERENCE_DIVERGENCE");
    expect(classifyReferenceStatus(-1.0001, 1)).toBe("NEGATIVE_REFERENCE_DIVERGENCE");
  });
});
