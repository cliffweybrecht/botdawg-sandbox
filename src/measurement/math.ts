/** Pure numeric helpers for Phase B V1 reference divergence — no I/O, no LLM. */

export function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

export function isFinitePositive(n: unknown): n is number {
  return isFiniteNumber(n) && n > 0;
}

export function rationalToNumber(numerator: string, denominator: string): number | null {
  if (!/^-?[0-9]+$/.test(numerator) || !/^-?[0-9]+$/.test(denominator)) return null;
  const den = Number(denominator);
  const num = Number(numerator);
  if (!Number.isFinite(den) || !Number.isFinite(num) || den === 0) return null;
  const v = num / den;
  return Number.isFinite(v) ? v : null;
}

export function roundHalfAwayFromZero(value: number, scale: number): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** scale;
  const shifted = value * factor;
  const signed = shifted < 0 ? -1 : 1;
  const rounded = signed * Math.floor(Math.abs(shifted) + 0.5);
  return rounded / factor;
}

/**
 * Authoritative reference divergence from underlying mark prices:
 * pct = (dexMedian - rh) / rh * 100
 * bps = pct * 100
 * usdPerShare = dexMedian - rh
 *
 * Requires rh > 0 and finite dex. Returns null on any non-finite result.
 */
export function computeReferenceDivergenceFromPrices(
  robinhoodReferencePriceUsd: number,
  dexMedianPriceUsd: number,
): { pct: number; bps: number; usdPerShare: number } | null {
  if (!isFinitePositive(robinhoodReferencePriceUsd)) return null;
  if (!isFiniteNumber(dexMedianPriceUsd) || dexMedianPriceUsd <= 0) return null;
  const usdPerShare = dexMedianPriceUsd - robinhoodReferencePriceUsd;
  const pct = (usdPerShare / robinhoodReferencePriceUsd) * 100;
  const bps = pct * 100;
  if (!isFiniteNumber(usdPerShare) || !isFiniteNumber(pct) || !isFiniteNumber(bps)) {
    return null;
  }
  return { pct, bps, usdPerShare };
}
