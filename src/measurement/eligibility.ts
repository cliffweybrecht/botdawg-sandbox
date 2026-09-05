import type { AssetIntelligence } from "../market/types.js";
import type { InsufficientReason } from "./types.js";
import { isFiniteNumber, isFinitePositive } from "./math.js";

/** Fail-closed: Terminal compare tokenIn must equal canonical stock contract (case-insensitive). */
export function assertStockTokenIn(
  tokenIn: string,
  canonicalContractAddress: string,
): boolean {
  return tokenIn.toLowerCase() === canonicalContractAddress.toLowerCase();
}

export function collectReferenceEligibilityFailures(
  asset: AssetIntelligence,
): InsufficientReason[] {
  const reasons: InsufficientReason[] = [];
  const row = asset.marketRow;
  const rh = row.robinhoodReferencePriceUsd;
  const dex = row.dexMedianPriceUsd;
  if (!isFiniteNumber(rh)) {
    reasons.push("MISSING_RH_PRICE");
  } else if (rh <= 0) {
    reasons.push("INVALID_RH_PRICE");
  } else if (!isFinitePositive(rh)) {
    reasons.push("INVALID_RH_PRICE");
  }
  if (!isFiniteNumber(dex)) {
    reasons.push("MISSING_DEX_MEDIAN");
  } else if (dex <= 0) {
    reasons.push("INVALID_DEX_MEDIAN");
  }
  return reasons;
}
