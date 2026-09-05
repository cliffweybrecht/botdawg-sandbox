import type { MarketLiquidityRow } from "../terminal/types.js";
import { ORDERING_METRIC } from "./types.js";

/** Deterministic selection: displayedLiquidityUsd desc, nulls last, contractAddress asc. */
export function selectDrilldownRows(
  rows: readonly MarketLiquidityRow[],
  limit: number,
): MarketLiquidityRow[] {
  if (limit <= 0) return [];
  const sorted = [...rows].sort((a, b) => {
    const av = a.displayedLiquidityUsd;
    const bv = b.displayedLiquidityUsd;
    if (av === null && bv === null) {
      return a.asset.contractAddress.localeCompare(b.asset.contractAddress);
    }
    if (av === null) return 1;
    if (bv === null) return -1;
    if (bv !== av) return bv - av;
    return a.asset.contractAddress.localeCompare(b.asset.contractAddress);
  });
  return sorted.slice(0, limit);
}

export function drilldownPolicyDescription(limit: number): string {
  return [
    `1) GET /api/market/liquidity`,
    `2) Order rows by ${ORDERING_METRIC} descending (nulls last; tie-break contractAddress ascending)`,
    `3) Take top ${limit} rows`,
    `4) For each symbol: POST .../execution/compare then POST .../execution/depth-thresholds with {}`,
    `5) Do not call GET /price (market rows already include headline premium fields)`,
  ].join("; ");
}
